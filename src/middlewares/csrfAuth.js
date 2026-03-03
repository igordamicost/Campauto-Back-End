/**
 * Proteção CSRF para rotas que usam cookies (refresh, logout).
 * Valida Origin/Referer contra CORS_ORIGINS.
 * Aceita IDN e punycode (ex: jrcarpecas.com.br = xn--jrcarpeas-w3a.com.br).
 */

import { domainToASCII } from "node:url";

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim().toLowerCase())
  .filter(Boolean);

function getRequestOrigin(req) {
  return req.headers.origin || req.headers.referer?.replace(/\/[^/]*$/, "") || null;
}

function originMatchesAllowed(origin, allowed) {
  const originNorm = origin.toLowerCase();
  if (originNorm === allowed || originNorm.startsWith(allowed + "/")) return true;
  try {
    const oUrl = new URL(allowed.startsWith("http") ? allowed : `https://${allowed}`);
    const reqUrl = new URL(originNorm);
    const oPuny = domainToASCII(oUrl.hostname);
    const reqPuny = domainToASCII(reqUrl.hostname);
    return oPuny === reqPuny && oUrl.protocol === reqUrl.protocol;
  } catch {
    return false;
  }
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
    const allowed = ALLOWED_ORIGINS.some((o) => originMatchesAllowed(origin, o));
    if (!allowed) {
      return res.status(403).json({ message: "Origin não permitida" });
    }
  }

  next();
}
