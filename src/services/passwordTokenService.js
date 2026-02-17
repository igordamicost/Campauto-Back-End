import crypto from "crypto";
import { getPool } from "../../db.js";

const TOKEN_BYTES = 32;
const EXPIRE_HOURS = 1;

/**
 * Gera token aleatório forte (hex).
 * Armazenamos apenas o hash SHA-256 para não expor o token no banco.
 */
export function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function expiresAt() {
  const d = new Date();
  d.setHours(d.getHours() + EXPIRE_HOURS);
  return d;
}

/**
 * Cria token do tipo FIRST_ACCESS ou RESET.
 * Remove tokens anteriores do mesmo user/type (apenas 1 ativo por tipo).
 * Retorna o token em claro (para enviar no email). O hash é salvo no DB.
 */
export async function createPasswordToken(userId, type) {
  const pool = getPool();
  const token = generateToken();
  const tokenHash = hashToken(token);

  await pool.query(
    "DELETE FROM password_reset_tokens WHERE user_id = ? AND type = ?",
    [userId, type]
  );

  await pool.query(
    `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, type)
      VALUES (?, ?, ?, ?)
    `,
    [userId, tokenHash, expiresAt(), type]
  );

  return token;
}

/**
 * Valida token e retorna userId.
 * Verifica hash, expiração e used_at.
 * Marca como usado (used_at) e retorna o userId.
 */
export async function consumeToken(token) {
  const pool = getPool();
  const tokenHash = hashToken(token);

  const [rows] = await pool.query(
    `
      SELECT id, user_id, expires_at, used_at
      FROM password_reset_tokens
      WHERE token_hash = ?
    `,
    [tokenHash]
  );

  const row = rows[0];
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?", [row.id]);
  return row.user_id;
}
