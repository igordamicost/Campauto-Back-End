-- Migração: Campo logo_base64 na tabela empresas
-- Armazena o logo da empresa em base64 para uso em telas e e-mails.

USE campauto;

-- Adicionar coluna logo_base64 se ainda não existir
SET @col_logo := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE()
    AND table_name = 'empresas'
    AND column_name = 'logo_base64'
);

SET @sql_logo := IF(
  @col_logo = 0,
  'ALTER TABLE empresas ADD COLUMN logo_base64 LONGTEXT NULL COMMENT ''Logo da empresa em base64'' AFTER estado',
  'SELECT 1'
);

PREPARE stmt_logo FROM @sql_logo;
EXECUTE stmt_logo;
DEALLOCATE PREPARE stmt_logo;

-- Tabela marcador para o MigrationService
CREATE TABLE IF NOT EXISTS empresas_logo_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

