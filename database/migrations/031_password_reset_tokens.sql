-- Garante que a tabela password_reset_tokens existe (usada por forgot-password e primeiro acesso).
-- O arquivo 001 não é executado pelo MigrationService; esta migration corrige isso.

USE campauto;

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

-- Marcador para o MigrationService
CREATE TABLE IF NOT EXISTS password_reset_tokens_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
