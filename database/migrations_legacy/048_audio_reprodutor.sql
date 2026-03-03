-- Migração: Módulo Reprodutor de Áudio (acesso restrito a user_id 2 e 14)
-- Tabelas para armazenar arquivos WAV e histórico de reprodução

-- ========== 1. Tabela audio_reprodutor_files ==========
CREATE TABLE IF NOT EXISTS audio_reprodutor_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  size_bytes BIGINT NOT NULL,
  duration_seconds INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 2. Tabela audio_reprodutor_history ==========
CREATE TABLE IF NOT EXISTS audio_reprodutor_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  file_id INT NOT NULL,
  position_seconds INT NOT NULL DEFAULT 0,
  is_finished TINYINT(1) NOT NULL DEFAULT 0,
  annotations TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_file (user_id, file_id),
  CONSTRAINT fk_arh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_arh_file FOREIGN KEY (file_id) REFERENCES audio_reprodutor_files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
