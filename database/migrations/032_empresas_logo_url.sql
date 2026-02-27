-- Migração: Substituir logo_base64 por logo_url na tabela empresas
-- Armazena apenas o link (URL) da imagem do logo para uso em telas e e-mails.

USE campauto;

-- Adicionar coluna logo_url se ainda não existir
SET @col_url := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE()
    AND table_name = 'empresas'
    AND column_name = 'logo_url'
);

SET @sql_url := IF(
  @col_url = 0,
  'ALTER TABLE empresas ADD COLUMN logo_url VARCHAR(512) NULL COMMENT ''URL do logo da empresa'' AFTER estado',
  'SELECT 1'
);

PREPARE stmt_url FROM @sql_url;
EXECUTE stmt_url;
DEALLOCATE PREPARE stmt_url;

-- Remover coluna logo_base64 se existir
SET @col_base64 := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE()
    AND table_name = 'empresas'
    AND column_name = 'logo_base64'
);

SET @sql_drop := IF(
  @col_base64 > 0,
  'ALTER TABLE empresas DROP COLUMN logo_base64',
  'SELECT 1'
);

PREPARE stmt_drop FROM @sql_drop;
EXECUTE stmt_drop;
DEALLOCATE PREPARE stmt_drop;

-- Tabela marcador para o MigrationService
CREATE TABLE IF NOT EXISTS empresas_logo_url_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
