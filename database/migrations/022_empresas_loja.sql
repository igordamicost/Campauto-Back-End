-- Migração: Campo loja (boolean) na tabela empresas
-- Indica quais empresas são usadas como loja (local de estoque). Front exibe badge "Loja" quando loja = 1.

USE campauto;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'empresas' AND column_name = 'loja');
SET @sql = IF(@col = 0, 'ALTER TABLE empresas ADD COLUMN loja TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''Indica se a empresa é loja (local de estoque)'' AFTER estado', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS empresas_loja_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
