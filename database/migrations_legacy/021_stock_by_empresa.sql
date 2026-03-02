-- Migração: Estoque por Empresa (loja = empresa)
-- Substitui location_id por empresa_id em stock_balances, stock_movements e reservations.
-- Requer ao menos uma empresa cadastrada. Executa com: mysql -u user -p database < 021_stock_by_empresa.sql

USE campauto;

-- ========== STOCK_BALANCES ==========
-- 1) Adicionar empresa_id (nullable)
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'stock_balances' AND column_name = 'empresa_id');
SET @sql = IF(@col = 0, 'ALTER TABLE stock_balances ADD COLUMN empresa_id INT NULL AFTER location_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Preencher empresa_id com primeira empresa (onde ainda for NULL)
UPDATE stock_balances SET empresa_id = (SELECT id FROM (SELECT id FROM empresas ORDER BY id LIMIT 1) t) WHERE empresa_id IS NULL;

-- 3) Remover FK e índice único antigos
SET @fk = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'stock_balances' AND constraint_name = 'fk_sb_location');
SET @sql2 = IF(@fk > 0, 'ALTER TABLE stock_balances DROP FOREIGN KEY fk_sb_location', 'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

SET @uk = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE table_schema = DATABASE() AND table_name = 'stock_balances' AND index_name = 'uniq_product_location');
SET @sql3 = IF(@uk > 0, 'ALTER TABLE stock_balances DROP INDEX uniq_product_location', 'SELECT 1');
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

-- 4) Remover coluna location_id
SET @loc = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'stock_balances' AND column_name = 'location_id');
SET @sql4 = IF(@loc > 0, 'ALTER TABLE stock_balances DROP COLUMN location_id', 'SELECT 1');
PREPARE stmt4 FROM @sql4; EXECUTE stmt4; DEALLOCATE PREPARE stmt4;

-- 5) empresa_id NOT NULL e default
ALTER TABLE stock_balances MODIFY COLUMN empresa_id INT NOT NULL DEFAULT 1;
ALTER TABLE stock_balances ADD UNIQUE KEY uniq_product_empresa (product_id, empresa_id);
ALTER TABLE stock_balances ADD CONSTRAINT fk_sb_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT;
ALTER TABLE stock_balances ADD INDEX idx_empresa (empresa_id);

-- ========== STOCK_MOVEMENTS ==========
SET @col2 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'stock_movements' AND column_name = 'empresa_id');
SET @sqla = IF(@col2 = 0, 'ALTER TABLE stock_movements ADD COLUMN empresa_id INT NULL AFTER location_id', 'SELECT 1');
PREPARE stma FROM @sqla; EXECUTE stma; DEALLOCATE PREPARE stma;

UPDATE stock_movements SET empresa_id = (SELECT id FROM (SELECT id FROM empresas ORDER BY id LIMIT 1) t) WHERE empresa_id IS NULL;

SET @fk2 = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'stock_movements' AND constraint_name = 'fk_sm_location');
SET @sqlb = IF(@fk2 > 0, 'ALTER TABLE stock_movements DROP FOREIGN KEY fk_sm_location', 'SELECT 1');
PREPARE stmb FROM @sqlb; EXECUTE stmb; DEALLOCATE PREPARE stmb;

SET @loc2 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'stock_movements' AND column_name = 'location_id');
SET @sqlc = IF(@loc2 > 0, 'ALTER TABLE stock_movements DROP COLUMN location_id', 'SELECT 1');
PREPARE stmc FROM @sqlc; EXECUTE stmc; DEALLOCATE PREPARE stmc;

ALTER TABLE stock_movements MODIFY COLUMN empresa_id INT NOT NULL DEFAULT 1;
ALTER TABLE stock_movements ADD CONSTRAINT fk_sm_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT;
ALTER TABLE stock_movements ADD INDEX idx_empresa (empresa_id);

-- ========== RESERVATIONS ==========
SET @col3 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'reservations' AND column_name = 'empresa_id');
SET @sqld = IF(@col3 = 0, 'ALTER TABLE reservations ADD COLUMN empresa_id INT NULL AFTER location_id', 'SELECT 1');
PREPARE stmd FROM @sqld; EXECUTE stmd; DEALLOCATE PREPARE stmd;

UPDATE reservations SET empresa_id = (SELECT id FROM (SELECT id FROM empresas ORDER BY id LIMIT 1) t) WHERE empresa_id IS NULL;

SET @fk3 = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'reservations' AND constraint_name = 'fk_res_location');
SET @sqle = IF(@fk3 > 0, 'ALTER TABLE reservations DROP FOREIGN KEY fk_res_location', 'SELECT 1');
PREPARE stme FROM @sqle; EXECUTE stme; DEALLOCATE PREPARE stme;

SET @loc3 = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'reservations' AND column_name = 'location_id');
SET @sqlf = IF(@loc3 > 0, 'ALTER TABLE reservations DROP COLUMN location_id', 'SELECT 1');
PREPARE stmf FROM @sqlf; EXECUTE stmf; DEALLOCATE PREPARE stmf;

ALTER TABLE reservations MODIFY COLUMN empresa_id INT NOT NULL DEFAULT 1;
ALTER TABLE reservations ADD CONSTRAINT fk_res_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT;
ALTER TABLE reservations ADD INDEX idx_empresa (empresa_id);

-- Marcador para o runner
CREATE TABLE IF NOT EXISTS stock_by_empresa_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
