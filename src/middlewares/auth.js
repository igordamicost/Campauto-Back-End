import jwt from "jsonwebtoken";
import { db } from "../config/database.js";
import { updateActivity } from "../services/sessionStore.service.js";

async function enrichUserWithRole(payload) {
  if (payload.roleId) {
    try {
      const [roleRows] = await db.query(
        "SELECT name FROM roles WHERE id = ?",
        [payload.roleId]
      );
      if (roleRows.length > 0) {
        payload.role = roleRows[0].name;
      }
    } catch (error) {
      console.warn("Erro ao buscar role do usuário:", error.message);
    }
  }
  return payload;
}

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Token inválido ou ausente" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    await enrichUserWithRole(payload);
    req.user = payload;

    const method = (req.method || "").toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && payload.sessionId) {
      await updateActivity(payload.sessionId).catch(() => {});
    }
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

/**
 * Middleware opcional: tenta validar token mas não falha se inválido.
 * Útil para logout (sempre limpa cookie; revoga sessão se token válido).
 */
export async function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    await enrichUserWithRole(payload);
    req.user = payload;
  } catch {
    req.user = undefined;
  }
  next();
}
