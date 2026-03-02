/**
 * Configuração de cookies para refresh token.
 */

const COOKIE_NAME = "refresh_token";
const COOKIE_SECURE = process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || "lax";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const COOKIE_PATH = "/";
const COOKIE_MAX_AGE_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 7;

export function getRefreshCookieOptions() {
  const opts = {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    path: COOKIE_PATH,
    maxAge: COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
  };
  if (COOKIE_DOMAIN) opts.domain = COOKIE_DOMAIN;
  return opts;
}

export function getClearCookieOptions() {
  const opts = {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    path: COOKIE_PATH,
    maxAge: 0,
  };
  if (COOKIE_DOMAIN) opts.domain = COOKIE_DOMAIN;
  return opts;
}

export { COOKIE_NAME };
