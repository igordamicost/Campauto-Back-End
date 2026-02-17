-- Migração: Integração Gmail API + tokens de senha
-- Executa com: mysql -u user -p database < 001_google_mail_integrations_password_tokens.sql

USE campauto;

-- A) google_mail_integrations
CREATE TABLE IF NOT EXISTS google_mail_integrations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_master_user_id BIGINT NOT NULL,
  sender_email VARCHAR(255) NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  client_secret_enc TEXT NOT NULL,
  client_secret_iv VARBINARY(16) NOT NULL,
  client_secret_tag VARBINARY(16) NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  refresh_token_iv VARBINARY(16) NOT NULL,
  refresh_token_tag VARBINARY(16) NOT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  last_tested_at DATETIME NULL,
  last_error TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_owner (owner_master_user_id),
  CONSTRAINT fk_gmail_owner FOREIGN KEY (owner_master_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- B) password_reset_tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  type ENUM('FIRST_ACCESS','RESET') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_type (user_id, type),
  UNIQUE KEY uniq_token_hash (token_hash),
  CONSTRAINT fk_pwd_token_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- C) users: permitir password NULL + must_set_password
-- Nota: must_set_password será adicionada pelo seed (ensureColumns) se não existir
ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL;
