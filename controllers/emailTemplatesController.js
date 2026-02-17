import { z } from "zod";
import { getPool } from "../db.js";
import { DEFAULT_FIRST_ACCESS, DEFAULT_RESET } from "../src/constants/defaultEmailTemplates.js";
import { renderTemplate } from "../src/services/templateRenderService.js";

const TEMPLATE_KEYS = ["FIRST_ACCESS", "RESET"];
const DEFAULTS = { FIRST_ACCESS: DEFAULT_FIRST_ACCESS, RESET: DEFAULT_RESET };

const putSchema = z.object({
  name: z.string().min(1).max(120),
  subject: z.string().min(1).max(160),
  htmlBody: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});

const previewSchema = z.object({
  subject: z.string(),
  htmlBody: z.string(),
});

const MOCK_DATA = {
  user_name: "João",
  user_email: "joao@exemplo.com",
  action_url: "https://exemplo.com/acao?token=abc",
  token_expires_in: "1 hora",
  company_name: "Minha Empresa",
};

function stripScript(html) {
  if (typeof html !== "string") return "";
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

async function list(req, res) {
  const masterUserId = req.user.userId;

  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT template_key, name, subject, html_body, is_active FROM email_templates WHERE owner_master_user_id = ?",
    [masterUserId]
  );

  const byKey = Object.fromEntries(rows.map((r) => [r.template_key, r]));

  const result = TEMPLATE_KEYS.map((key) => {
    const row = byKey[key];
    if (row) {
      return {
        templateKey: key,
        name: row.name,
        subject: row.subject,
        htmlBody: row.html_body,
        isActive: Boolean(row.is_active),
      };
    }
    const def = DEFAULTS[key] || {};
    return {
      templateKey: key,
      name: def.name || key,
      subject: def.subject || "",
      htmlBody: def.html_body || "",
      isActive: true,
    };
  });

  res.json({ data: result });
}

async function update(req, res) {
  const { templateKey } = req.params;
  const masterUserId = req.user.userId;

  if (!TEMPLATE_KEYS.includes(templateKey)) {
    return res.status(400).json({ message: "templateKey inválido. Use FIRST_ACCESS ou RESET" });
  }

  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Dados inválidos",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { name, subject, htmlBody, isActive } = parsed.data;
  const safeHtml = stripScript(htmlBody);

  const pool = getPool();
  await pool.query(
    `
    INSERT INTO email_templates (owner_master_user_id, template_key, name, subject, html_body, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      subject = VALUES(subject),
      html_body = VALUES(html_body),
      is_active = VALUES(is_active),
      updated_at = NOW()
  `,
    [masterUserId, templateKey, name, subject, safeHtml, isActive ? 1 : 0]
  );

  const [rows] = await pool.query(
    "SELECT template_key, name, subject, html_body, is_active FROM email_templates WHERE owner_master_user_id = ? AND template_key = ?",
    [masterUserId, templateKey]
  );

  const r = rows[0];
  res.json({
    templateKey: r.template_key,
    name: r.name,
    subject: r.subject,
    htmlBody: r.html_body,
    isActive: Boolean(r.is_active),
  });
}

async function preview(req, res) {
  const { templateKey } = req.params;

  if (!TEMPLATE_KEYS.includes(templateKey)) {
    return res.status(400).json({ message: "templateKey inválido. Use FIRST_ACCESS ou RESET" });
  }

  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "subject e htmlBody são obrigatórios",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { subject, htmlBody } = parsed.data;
  const safeHtml = stripScript(htmlBody);

  const renderedSubject = renderTemplate(subject, MOCK_DATA);
  const renderedHtml = renderTemplate(safeHtml, MOCK_DATA);

  res.json({ renderedSubject, renderedHtml });
}

export { list, update, preview };
