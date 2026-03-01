import { transporter } from "../config/email.js";
import { DEFAULT_FROM } from "../config/mail.js";

export async function sendEmail(to, subject, html, attachments = []) {
  return transporter.sendMail({
    from: DEFAULT_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    attachments,
  });
}

const CID_LOGO = "company-logo";

function htmlEscape(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Monta o HTML do header (logo inline ou fallback texto).
 * @param {string} companyName
 * @param {boolean} hasLogo
 */
export function buildCompanyHeaderHtml(companyName, hasLogo) {
  const name = htmlEscape(companyName || "");
  if (hasLogo) {
    return `<img src="cid:company-logo" alt="${name}" style="max-width:200px;height:auto" />`;
  }
  return `<span style="font-weight:bold;font-size:18px;color:#111">${name}</span>`;
}

/**
 * Envia e-mail com logo inline via CID (Content-ID).
 * Compatível com Gmail/Outlook mesmo com "bloquear imagens externas".
 *
 * @param {string} to - Destinatário
 * @param {string} subject - Assunto
 * @param {string} html - HTML já renderizado (deve usar cid:company-logo no img quando logo anexado)
 * @param {{ logoAttachment?: { buffer: Buffer, contentType: string, filename: string } | null }} options
 */
export async function sendEmailWithInlineLogo(to, subject, html, options = {}) {
  const { logoAttachment } = options;
  const attachments = [];

  if (logoAttachment?.buffer) {
    attachments.push({
      filename: logoAttachment.filename || "logo.png",
      content: logoAttachment.buffer,
      contentType: logoAttachment.contentType || "image/png",
      cid: CID_LOGO,
    });
    console.log("[email] Logo inline anexado (cid:company-logo)");
  }

  return transporter.sendMail({
    from: DEFAULT_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    attachments: attachments.length ? attachments : undefined,
  });
}
