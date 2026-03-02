-- Migração: Coluna tags (JSON) em orcamentos para tags de venda (venda_realizada, venda_nao_realizada)

USE campauto;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'orcamentos' AND column_name = 'tags'
);

SET @sql_add := IF(@col_exists = 0,
  'ALTER TABLE orcamentos ADD COLUMN tags JSON NULL COMMENT ''Array de tags: venda_realizada, venda_nao_realizada'' AFTER status',
  'SELECT 1');

PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

CREATE TABLE IF NOT EXISTS orcamentos_tags_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
