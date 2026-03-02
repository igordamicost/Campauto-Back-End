-- Migração: Sessões server-side para refresh token rotativo

USE campauto;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  refresh_token_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  user_agent VARCHAR(512) NULL,
  ip VARCHAR(45) NULL,
  INDEX idx_user (user_id),
  INDEX idx_expires (expires_at),
  INDEX idx_revoked (revoked_at),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Sessões de autenticação com refresh token';

-- Tokens supersedidos (para detecção de replay)
CREATE TABLE IF NOT EXISTS auth_sessions_superseded (
  token_hash VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  superseded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS auth_sessions_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
