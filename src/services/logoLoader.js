/**
 * Carrega logo para anexo inline em e-mails (CID).
 * Ordem de prioridade: logoUrl (empresa) > COMPANY_LOGO_URL > COMPANY_LOGO_PATH.
 * Usa fetch nativo (Node 18+) ou https para compatibilidade.
 */

import fs from "fs";
import https from "https";
import http from "http";

const CONTENT_TYPE_MAP = {
  "image/png": { contentType: "image/png", filename: "logo.png" },
  "image/jpeg": { contentType: "image/jpeg", filename: "logo.jpg" },
  "image/jpg": { contentType: "image/jpeg", filename: "logo.jpg" },
  "image/webp": { contentType: "image/webp", filename: "logo.webp" },
  "image/gif": { contentType: "image/gif", filename: "logo.gif" },
};

function parseContentType(header) {
  if (!header) return null;
  const match = String(header).match(/^([^;]+)/);
  const type = match ? match[1].trim().toLowerCase() : null;
  return CONTENT_TYPE_MAP[type] || (type?.startsWith("image/") ? { contentType: type, filename: "logo.png" } : null);
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const req = protocol.get(url, { timeout: 10000 }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const contentType = parseContentType(res.headers["content-type"]);
        resolve({ buffer, contentType });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout ao baixar logo"));
    });
  });
}

async function loadFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return null;
  try {
    const { buffer, contentType } = await fetchUrl(trimmed);
    if (!buffer || buffer.length === 0) return null;
    return {
      buffer,
      contentType: contentType?.contentType || "image/png",
      filename: contentType?.filename || "logo.png",
    };
  } catch (err) {
    console.warn("[logoLoader] Falha ao baixar logo de URL:", trimmed, err?.message || err);
    return null;
  }
}

async function loadFromPath(filePath) {
  if (!filePath || typeof filePath !== "string") return null;
  const trimmed = filePath.trim();
  if (!trimmed) return null;
  try {
    const buffer = fs.readFileSync(trimmed);
    if (!buffer || buffer.length === 0) return null;
    const ext = trimmed.split(".").pop()?.toLowerCase();
    const typeMap = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
    const contentType = typeMap[ext] || "image/png";
    const filename = typeMap[ext] ? `logo.${ext}` : "logo.png";
    return { buffer, contentType, filename };
  } catch (err) {
    console.warn("[logoLoader] Falha ao ler logo do disco:", trimmed, err?.message || err);
    return null;
  }
}

/**
 * Carrega logo para uso inline em e-mail.
 * Ordem: logoUrl (empresa) > COMPANY_LOGO_URL > COMPANY_LOGO_PATH.
 * @param {{ logoUrl?: string | null }} options
 * @returns {Promise<{ buffer: Buffer, contentType: string, filename: string } | null>}
 */
export async function loadLogo(options = {}) {
  const { logoUrl } = options;
  const envUrl = process.env.COMPANY_LOGO_URL?.trim();
  const envPath = process.env.COMPANY_LOGO_PATH?.trim();

  if (logoUrl) {
    const result = await loadFromUrl(logoUrl);
    if (result) return result;
  }
  if (envUrl) {
    const result = await loadFromUrl(envUrl);
    if (result) return result;
  }
  if (envPath) {
    const result = await loadFromPath(envPath);
    if (result) return result;
  }
  return null;
}
