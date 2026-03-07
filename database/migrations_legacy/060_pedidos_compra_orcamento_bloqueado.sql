-- Migration 060: orcamento_id em pedidos_compra + qty_blocked (bloqueados)
-- Permite vincular pedido de compra a orçamento e calcular quantidade bloqueada

-- 1) Adicionar orcamento_id em pedidos_compra
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'pedidos_compra' AND column_name = 'orcamento_id'
);
SET @sql_add := IF(@col_exists = 0,
  'ALTER TABLE pedidos_compra ADD COLUMN orcamento_id INT NULL AFTER empresa_id,
   ADD INDEX idx_orcamento (orcamento_id),
   ADD CONSTRAINT fk_pc_orcamento FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql_add;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
