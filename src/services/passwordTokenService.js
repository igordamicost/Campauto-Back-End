import crypto from "crypto";
import { getPool } from "../../db.js";

const TOKEN_BYTES = 32;
const DEFAULT_EXPIRE_HOURS = 1;
const FIRST_ACCESS_EXPIRE_HOURS = 24 * 7; // 7 dias

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

function expiresAt(hours = DEFAULT_EXPIRE_HOURS) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d;
}

/**
 * Cria token do tipo FIRST_ACCESS ou RESET.
 * Remove tokens anteriores do mesmo user/type (apenas 1 ativo por tipo).
 * Retorna o token em claro (para enviar no email). O hash é salvo no DB.
 * @param {number} userId
 * @param {string} type - 'FIRST_ACCESS' | 'RESET'
 * @param {number} [expiresInHours] - expiração em horas (default: 1 para RESET, 168 para FIRST_ACCESS)
 */
export async function createPasswordToken(userId, type, expiresInHours) {
  const pool = getPool();
  const token = generateToken();
  const tokenHash = hashToken(token);

  const hours =
    expiresInHours ??
    (type === "FIRST_ACCESS" ? FIRST_ACCESS_EXPIRE_HOURS : DEFAULT_EXPIRE_HOURS);

  await pool.query(
    "DELETE FROM password_reset_tokens WHERE user_id = ? AND type = ?",
    [userId, type]
  );

  await pool.query(
    `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, type)
      VALUES (?, ?, ?, ?)
    `,
    [userId, tokenHash, expiresAt(hours), type]
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
