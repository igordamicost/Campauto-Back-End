import { getPool } from "../../db.js";
import {
  DEFAULT_FIRST_ACCESS,
  DEFAULT_RESET,
  DEFAULT_SUPPLIER_ORDER,
  DEFAULT_CLIENT_QUOTE,
} from "../constants/defaultEmailTemplates.js";

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      template_key ENUM('FIRST_ACCESS','RESET','SUPPLIER_ORDER','CLIENT_QUOTE') NOT NULL,
      name VARCHAR(120) NOT NULL,
      subject VARCHAR(160) NOT NULL,
      html_body MEDIUMTEXT NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_template_key (template_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function seedEmailTemplates() {
  const pool = getPool();
  await ensureTable(pool);

  const defaults = [
    { key: "FIRST_ACCESS", def: DEFAULT_FIRST_ACCESS },
    { key: "RESET", def: DEFAULT_RESET },
    { key: "SUPPLIER_ORDER", def: DEFAULT_SUPPLIER_ORDER },
    { key: "CLIENT_QUOTE", def: DEFAULT_CLIENT_QUOTE },
  ];

  for (const { key, def } of defaults) {
    const [rows] = await pool.query(
      "SELECT id FROM email_templates WHERE template_key = ?",
      [key]
    );
    if (rows.length === 0) {
      await pool.query(
        `
        INSERT INTO email_templates (template_key, name, subject, html_body, is_active)
        VALUES (?, ?, ?, ?, 1)
        `,
        [key, def.name, def.subject, def.html_body]
      );
    }
  }
}

export { seedEmailTemplates };
