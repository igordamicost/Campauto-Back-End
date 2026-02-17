/**
 * Escape HTML para evitar XSS. Valores são escapados em texto e atributos.
 */
function htmlEscape(str) {
  if (str == null) return "";
  const s = String(str);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PLACEHOLDERS = [
  "user_name",
  "user_email",
  "action_url",
  "token_expires_in",
  "company_name",
];

/**
 * Remove ou neutraliza <script> para evitar execução de JS.
 */
function sanitizeHtml(html) {
  if (typeof html !== "string") return "";
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

/**
 * Substitui placeholders por valores escapados.
 * @param {string} template - HTML ou subject
 * @param {Record<string, string>} data - Valores para os placeholders
 */
export function renderTemplate(template, data = {}) {
  if (!template || typeof template !== "string") return "";
  let result = sanitizeHtml(template);

  for (const key of PLACEHOLDERS) {
    const value = data[key] ?? "";
    const escaped = htmlEscape(value);
    const re = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(re, escaped);
  }

  return result;
}
