/**
 * Middleware: acesso restrito ao módulo Reprodutor de Áudio.
 * Apenas user_id 2 e 14 podem acessar.
 */

import jwt from "jsonwebtoken";

const ALLOWED_USER_IDS = [2, 14];

export function audioReprodutorAuth(req, res, next) {
  const userId = req.user?.userId ?? req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  if (!ALLOWED_USER_IDS.includes(Number(userId))) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}

/**
 * Middleware para stream: aceita token em Authorization ou ?token= (para <audio src>).
 * Valida e restringe a user 2 ou 14.
 */
export async function audioReprodutorStreamAuth(req, res, next) {
  const token =
    req.query.token ||
    req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({ message: "Token necessário" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = payload.userId ?? payload.id;
    if (!ALLOWED_USER_IDS.includes(Number(userId))) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido" });
  }
}
