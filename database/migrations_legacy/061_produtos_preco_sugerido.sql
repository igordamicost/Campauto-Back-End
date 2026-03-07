-- Migration 061: Coluna preco_sugerido em produtos
-- Último preço de venda (sugestão para próximos orçamentos) - atualizado ao faturar orçamento

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'produtos' AND column_name = 'preco_sugerido'
);
SET @sql_add := IF(@col_exists = 0,
  'ALTER TABLE produtos ADD COLUMN preco_sugerido DECIMAL(10,2) NULL COMMENT ''Último preço de venda (sugestão)'' AFTER preco_custo',
  'SELECT 1');
PREPARE stmt FROM @sql_add;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
