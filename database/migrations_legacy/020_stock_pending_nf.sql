-- Migração: Estoque - Aguardando NF (qty_pending_nf) e compatibilidade com saldos
-- Executa com: mysql -u user -p database < 020_stock_pending_nf.sql

USE campauto;

-- 1) Adicionar coluna qty_pending_nf em stock_balances (se não existir)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'stock_balances' AND column_name = 'qty_pending_nf'
);
SET @sql_add = IF(@col_exists = 0,
  'ALTER TABLE stock_balances ADD COLUMN qty_pending_nf DECIMAL(10,3) NOT NULL DEFAULT 0.000 COMMENT ''Quantidade faturada aguardando NF'' AFTER qty_reserved',
  'SELECT 1');
PREPARE stmt FROM @sql_add;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Ajustar coluna gerada qty_available para (qty_on_hand - qty_reserved - qty_pending_nf)
-- Só altera se a coluna qty_pending_nf existir (evita erro em MySQL antigo)
SET @col_pnf = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'stock_balances' AND column_name = 'qty_pending_nf'
);
SET @sql_mod = IF(@col_pnf > 0,
  'ALTER TABLE stock_balances MODIFY COLUMN qty_available DECIMAL(10,3) GENERATED ALWAYS AS (qty_on_hand - qty_reserved - qty_pending_nf) STORED',
  'SELECT 1');
PREPARE stmt2 FROM @sql_mod;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 3) Tabela marcadora para o runner executar esta migration apenas uma vez
CREATE TABLE IF NOT EXISTS stock_pending_nf_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
