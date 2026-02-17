-- Migração: Templates de e-mail HTML
-- Executa com: mysql -u user -p campauto < 002_email_templates.sql

USE campauto;

CREATE TABLE IF NOT EXISTS email_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_master_user_id INT NOT NULL,
  template_key ENUM('FIRST_ACCESS','RESET') NOT NULL,
  name VARCHAR(120) NOT NULL,
  subject VARCHAR(160) NOT NULL,
  html_body MEDIUMTEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_owner_key (owner_master_user_id, template_key),
  CONSTRAINT fk_email_tpl_owner FOREIGN KEY (owner_master_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
