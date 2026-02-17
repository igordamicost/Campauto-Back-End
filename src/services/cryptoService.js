import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Obtém chave de 32 bytes. Aceita base64 ou hex.
 * Nunca logar a chave.
 */
function getKey() {
  const raw = process.env.GOOGLE_OAUTH_ENC_KEY;
  if (!raw || typeof raw !== "string") {
    throw new Error("GOOGLE_OAUTH_ENC_KEY não configurada");
  }
  const trimmed = raw.trim();
  let buf;
  if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
    buf = Buffer.from(trimmed, "hex");
  } else {
    buf = Buffer.from(trimmed, "base64");
  }
  if (buf.length !== KEY_LENGTH) {
    throw new Error("GOOGLE_OAUTH_ENC_KEY deve ser 32 bytes (base64 ou hex)");
  }
  return buf;
}

/**
 * Criptografa texto com AES-256-GCM.
 * Retorna { encrypted, iv, authTag } em base64.
 */
export function encrypt(plaintext) {
  if (plaintext == null || typeof plaintext !== "string") {
    throw new Error("plaintext inválido");
  }
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString("base64"),
    iv: iv,
    authTag,
  };
}

/**
 * Descriptografa texto. Aceita Buffer ou base64 para iv/authTag.
 */
export function decrypt(encryptedB64, iv, authTag) {
  if (!encryptedB64 || !iv || !authTag) {
    throw new Error("parâmetros de decrypt inválidos");
  }
  const key = getKey();
  const ivBuf = Buffer.isBuffer(iv) ? iv : Buffer.from(iv, "base64");
  const tagBuf = Buffer.isBuffer(authTag) ? authTag : Buffer.from(authTag, "base64");
  const encBuf = Buffer.from(encryptedB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuf, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tagBuf);
  return decipher.update(encBuf) + decipher.final("utf8");
}
