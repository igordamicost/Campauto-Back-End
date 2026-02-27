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
 * Obtém owner_master_user_id da primeira integração ACTIVE (para RESET sem master em contexto).
 */
async function getFirstIntegrationOwnerId() {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT owner_master_user_id FROM google_mail_integrations WHERE status = 'ACTIVE' LIMIT 1"
  );
  return rows[0]?.owner_master_user_id ?? null;
}

/**
 * Busca template do banco. Se não existir ou inativo, retorna default.
 */
export async function getTemplate(masterUserIdOrNull, templateKey) {
  if (!TEMPLATE_KEYS.includes(templateKey)) return DEFAULTS[templateKey] ?? null;

  let ownerId = masterUserIdOrNull;
  if (!ownerId) {
    ownerId = await getFirstIntegrationOwnerId();
  }

  if (ownerId) {
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT name, subject, html_body FROM email_templates WHERE owner_master_user_id = ? AND template_key = ? AND is_active = 1",
      [ownerId, templateKey]
    );
    if (rows[0]) {
      return { name: rows[0].name, subject: rows[0].subject, html_body: rows[0].html_body };
    }
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
