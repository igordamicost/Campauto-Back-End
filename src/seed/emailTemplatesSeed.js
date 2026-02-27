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
      owner_master_user_id INT NOT NULL,
      template_key ENUM('FIRST_ACCESS','RESET','SUPPLIER_ORDER','CLIENT_QUOTE') NOT NULL,
      name VARCHAR(120) NOT NULL,
      subject VARCHAR(160) NOT NULL,
      html_body MEDIUMTEXT NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_owner_key (owner_master_user_id, template_key),
      CONSTRAINT fk_email_tpl_owner FOREIGN KEY (owner_master_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function seedEmailTemplates() {
  const pool = getPool();
  await ensureTable(pool);

  const [masters] = await pool.query(
    "SELECT id FROM users WHERE role = 'MASTER'"
  );

  for (const m of masters) {
    const ownerId = m.id;

    const [first] = await pool.query(
      "SELECT id FROM email_templates WHERE owner_master_user_id = ? AND template_key = 'FIRST_ACCESS'",
      [ownerId]
    );
    if (first.length === 0) {
      await pool.query(
        `
        INSERT INTO email_templates (owner_master_user_id, template_key, name, subject, html_body, is_active)
        VALUES (?, 'FIRST_ACCESS', ?, ?, ?, 1)
        `,
        [ownerId, DEFAULT_FIRST_ACCESS.name, DEFAULT_FIRST_ACCESS.subject, DEFAULT_FIRST_ACCESS.html_body]
      );
    }

    const [reset] = await pool.query(
      "SELECT id FROM email_templates WHERE owner_master_user_id = ? AND template_key = 'RESET'",
      [ownerId]
    );
    if (reset.length === 0) {
      await pool.query(
        `
        INSERT INTO email_templates (owner_master_user_id, template_key, name, subject, html_body, is_active)
        VALUES (?, 'RESET', ?, ?, ?, 1)
        `,
        [ownerId, DEFAULT_RESET.name, DEFAULT_RESET.subject, DEFAULT_RESET.html_body]
      );
    }

    const [sup] = await pool.query(
      "SELECT id FROM email_templates WHERE owner_master_user_id = ? AND template_key = 'SUPPLIER_ORDER'",
      [ownerId]
    );
    if (sup.length === 0) {
      await pool.query(
        `
        INSERT INTO email_templates (owner_master_user_id, template_key, name, subject, html_body, is_active)
        VALUES (?, 'SUPPLIER_ORDER', ?, ?, ?, 1)
        `,
        [
          ownerId,
          DEFAULT_SUPPLIER_ORDER.name,
          DEFAULT_SUPPLIER_ORDER.subject,
          DEFAULT_SUPPLIER_ORDER.html_body,
        ]
      );
    }

    const [cli] = await pool.query(
      "SELECT id FROM email_templates WHERE owner_master_user_id = ? AND template_key = 'CLIENT_QUOTE'",
      [ownerId]
    );
    if (cli.length === 0) {
      await pool.query(
        `
        INSERT INTO email_templates (owner_master_user_id, template_key, name, subject, html_body, is_active)
        VALUES (?, 'CLIENT_QUOTE', ?, ?, ?, 1)
        `,
        [
          ownerId,
          DEFAULT_CLIENT_QUOTE.name,
          DEFAULT_CLIENT_QUOTE.subject,
          DEFAULT_CLIENT_QUOTE.html_body,
        ]
      );
    }
  }
}

export { seedEmailTemplates };
