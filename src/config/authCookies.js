/**
 * Configuração de cookies para refresh token.
 */

import { domainToASCII } from "node:url";

const COOKIE_NAME = "refresh_token";
const COOKIE_SECURE = process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";
// Para cross-origin (frontend e API em domínios diferentes): use "none"
const COOKIE_SAMESITE_RAW = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
const COOKIE_SAMESITE =
  COOKIE_SAMESITE_RAW === "none" ? "none" : COOKIE_SAMESITE_RAW === "strict" ? "strict" : "lax";
const COOKIE_PATH = "/";
const COOKIE_MAX_AGE_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 7;

function getValidDomain() {
  const raw = process.env.COOKIE_DOMAIN;
  if (!raw || typeof raw !== "string") return undefined;
  const d = raw.trim().toLowerCase();
  if (!d) return undefined;
  if (d.includes("://") || d.includes("/") || d.includes(":")) return undefined;
  try {
    const ascii = domainToASCII(d);
    return ascii && ascii.length > 0 ? ascii : undefined;
  } catch {
    return /^[a-z0-9.-]+$/.test(d) ? d : undefined;
  }
}

const COOKIE_DOMAIN = getValidDomain();

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
