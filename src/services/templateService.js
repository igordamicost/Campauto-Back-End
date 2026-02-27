import { getPool } from "../../db.js";
import {
  DEFAULT_FIRST_ACCESS,
  DEFAULT_RESET,
  DEFAULT_SUPPLIER_ORDER,
  DEFAULT_CLIENT_QUOTE,
} from "../constants/defaultEmailTemplates.js";
import { renderTemplate } from "./templateRenderService.js";

const TEMPLATE_KEYS = ["FIRST_ACCESS", "RESET", "SUPPLIER_ORDER", "CLIENT_QUOTE"];
const DEFAULTS = {
  FIRST_ACCESS: DEFAULT_FIRST_ACCESS,
  RESET: DEFAULT_RESET,
  SUPPLIER_ORDER: DEFAULT_SUPPLIER_ORDER,
  CLIENT_QUOTE: DEFAULT_CLIENT_QUOTE,
};

/**
 * Busca template global do banco. Se não existir ou inativo, retorna default.
 * masterUserIdOrNull é ignorado para lookup (templates são globais).
 */
export async function getTemplate(masterUserIdOrNull, templateKey) {
  if (!TEMPLATE_KEYS.includes(templateKey)) return DEFAULTS[templateKey] ?? null;

  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT name, subject, html_body FROM email_templates WHERE template_key = ? AND is_active = 1",
    [templateKey]
  );

  if (rows[0]) {
    return {
      name: rows[0].name,
      subject: rows[0].subject,
      html_body: rows[0].html_body,
    };
  }

  return DEFAULTS[templateKey];
}

/**
 * Renderiza template com dados e retorna { subject, html }.
 */
export function renderWithData(template, data) {
  return {
    subject: renderTemplate(template.subject, data),
    html: renderTemplate(template.html_body, data),
  };
}
