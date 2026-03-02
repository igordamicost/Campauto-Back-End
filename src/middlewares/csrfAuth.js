/**
 * Proteção CSRF para rotas que usam cookies (refresh, logout).
 * Opção A: SameSite + checagem de Origin/Referer.
 */

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function getRequestOrigin(req) {
  return req.headers.origin || req.headers.referer?.replace(/\/[^/]*$/, "") || null;
}

/**
 * Middleware: valida Origin/Referer para requisições com credenciais.
 * Em desenvolvimento (NODE_ENV !== production), aceita qualquer origin.
 */
export function csrfAuthMiddleware(req, res, next) {
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  const origin = getRequestOrigin(req);
  if (!origin) {
    return res.status(403).json({ message: "Origin/Referer ausente" });
  }

  if (ALLOWED_ORIGINS.length > 0) {
    const allowed = ALLOWED_ORIGINS.some((o) => origin.startsWith(o) || origin === o);
    if (!allowed) {
      return res.status(403).json({ message: "Origin não permitida" });
    }
  }

  next();
}
