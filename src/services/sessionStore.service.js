/**
 * Session store para autenticação com refresh token rotativo.
 * Usa MySQL (DB) para armazenar sessões.
 */

import crypto from "crypto";
import { db } from "../config/database.js";

const ACCESS_TTL_MIN = Number(process.env.ACCESS_TOKEN_TTL_MIN) || 10;
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 7;
const IDLE_TIMEOUT_MIN = Number(process.env.IDLE_TIMEOUT_MIN) || 30;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateSessionId() {
  return crypto.randomBytes(32).toString("hex");
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

/**
 * Cria nova sessão e retorna { sessionId, refreshToken, refreshTokenHash }
 */
export async function createSession(userId, meta = {}) {
  const sessionId = generateSessionId();
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);

  await db.query(
    `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, created_at, last_activity_at, expires_at, user_agent, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      userId,
      refreshTokenHash,
      now,
      now,
      expiresAt,
      meta.userAgent || null,
      meta.ip || null,
    ]
  );

  return { sessionId, refreshToken, refreshTokenHash };
}

/**
 * Busca sessão por sessionId
 */
export async function getSession(sessionId) {
  const [rows] = await db.query(
    `SELECT id, user_id, refresh_token_hash, created_at, last_activity_at, expires_at, revoked_at
     FROM auth_sessions WHERE id = ?`,
    [sessionId]
  );
  return rows[0] || null;
}

/**
 * Valida refresh token e retorna sessão se válida.
 * Retorna { session, valid: true } ou { valid: false, revokeFamily?: true }
 * revokeFamily = true quando replay detectado (token supersedido)
 */
export async function validateRefreshToken(refreshToken) {
  const hash = hashToken(refreshToken);

  const [rows] = await db.query(
    `SELECT id, user_id, refresh_token_hash, created_at, last_activity_at, expires_at, revoked_at
     FROM auth_sessions
     WHERE refresh_token_hash = ?`,
    [hash]
  );

  const session = rows[0];
  if (!session) {
    const [superseded] = await db.query(
      `SELECT session_id FROM auth_sessions_superseded WHERE token_hash = ?`,
      [hash]
    );
    if (superseded?.length > 0) {
      await revokeSession(superseded[0].session_id);
      return { valid: false, revokeFamily: true };
    }
    return { valid: false };
  }

  const now = new Date();
  if (session.revoked_at) {
    return { valid: false, revokeFamily: true };
  }
  if (new Date(session.expires_at) < now) {
    return { valid: false };
  }

  const lastActivity = new Date(session.last_activity_at);
  const idleMs = IDLE_TIMEOUT_MIN * 60 * 1000;
  if (now - lastActivity > idleMs) {
    await revokeSession(session.id);
    return { valid: false };
  }

  return { session, valid: true };
}

/**
 * Rotação: guarda hash antigo em superseded, atualiza com novo refresh token.
 * Retorna { sessionId, refreshToken } ou null se falhar.
 */
export async function rotateRefreshToken(sessionId, oldTokenHash) {
  const session = await getSession(sessionId);
  if (!session || session.revoked_at) return null;

  const newRefreshToken = generateRefreshToken();
  const newHash = hashToken(newRefreshToken);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);

  await db.query(
    `INSERT INTO auth_sessions_superseded (token_hash, session_id) VALUES (?, ?)`,
    [oldTokenHash, sessionId]
  ).catch(() => {});

  await db.query(
    `UPDATE auth_sessions
     SET refresh_token_hash = ?, last_activity_at = ?, expires_at = ?
     WHERE id = ?`,
    [newHash, now, expiresAt, sessionId]
  );

  return { sessionId, refreshToken: newRefreshToken };
}

/**
 * Revoga sessão (revoked_at = now)
 */
export async function revokeSession(sessionId) {
  const [result] = await db.query(
    `UPDATE auth_sessions SET revoked_at = NOW() WHERE id = ?`,
    [sessionId]
  );
  return result.affectedRows > 0;
}

/**
 * Revoga todas as sessões de um usuário
 */
export async function revokeAllUserSessions(userId) {
  const [result] = await db.query(
    `UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = ?`,
    [userId]
  );
  return result.affectedRows;
}

/**
 * Atualiza last_activity_at da sessão
 */
export async function updateActivity(sessionId) {
  const [result] = await db.query(
    `UPDATE auth_sessions SET last_activity_at = NOW() WHERE id = ? AND revoked_at IS NULL`,
    [sessionId]
  );
  return result.affectedRows > 0;
}

/**
 * Limpa sessões expiradas ou revogadas (job de manutenção)
 */
export async function cleanupExpiredSessions() {
  const [result] = await db.query(
    `DELETE FROM auth_sessions
     WHERE revoked_at IS NOT NULL
        OR expires_at < NOW()`
  );
  await db.query(
    `DELETE FROM auth_sessions_superseded
     WHERE superseded_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`
  ).catch(() => {});
  return result.affectedRows;
}

export { ACCESS_TTL_MIN, REFRESH_TTL_DAYS, IDLE_TIMEOUT_MIN };
