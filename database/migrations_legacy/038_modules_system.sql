-- Migração: Sistema de Módulos (modules) e vínculo permissions -> modules
-- Executa com: mysql -u user -p database < 038_modules_system.sql

USE campauto;

-- 1) Tabela de Módulos
CREATE TABLE IF NOT EXISTS modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Inserir módulos padrão a partir das permissões existentes
INSERT IGNORE INTO modules (`key`, label, description) VALUES
  ('vendas', 'Vendas', 'Módulo de vendas e orçamentos'),
  ('oficina', 'Oficina', 'Módulo de ordens de serviço e checklists'),
  ('estoque', 'Estoque', 'Módulo de estoque e reservas'),
  ('financeiro', 'Financeiro', 'Módulo financeiro'),
  ('rh', 'RH', 'Módulo de recursos humanos'),
  ('contabil', 'Contábil', 'Módulo contábil'),
  ('admin', 'Administração', 'Módulo de administração do sistema');

-- 3) Adicionar coluna module_id em permissions
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'permissions' AND column_name = 'module_id');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE permissions ADD COLUMN module_id INT NULL AFTER id',
  'SELECT "Column module_id already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4) Adicionar coluna endpoint_pattern em permissions
SET @col_ep = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'permissions' AND column_name = 'endpoint_pattern');
SET @sql_ep = IF(@col_ep = 0,
  'ALTER TABLE permissions ADD COLUMN endpoint_pattern VARCHAR(255) NULL AFTER description',
  'SELECT "Column endpoint_pattern already exists" AS message');
PREPARE stmt_ep FROM @sql_ep;
EXECUTE stmt_ep;
DEALLOCATE PREPARE stmt_ep;

-- 5) Adicionar updated_at em permissions (se não existir)
SET @col_ua = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'permissions' AND column_name = 'updated_at');
SET @sql_ua = IF(@col_ua = 0,
  'ALTER TABLE permissions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT "Column updated_at already exists" AS message');
PREPARE stmt_ua FROM @sql_ua;
EXECUTE stmt_ua;
DEALLOCATE PREPARE stmt_ua;

-- 6) Preencher module_id baseado na coluna module (string)
UPDATE permissions p
INNER JOIN modules m ON m.`key` = p.module
SET p.module_id = m.id
WHERE p.module_id IS NULL AND p.module IS NOT NULL;

-- 7) Adicionar FK module_id -> modules
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema = DATABASE() AND table_name = 'permissions' AND constraint_name = 'fk_permissions_module');
SET @sql_fk = IF(@fk_exists = 0,
  'ALTER TABLE permissions ADD CONSTRAINT fk_permissions_module FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL',
  'SELECT "Foreign key fk_permissions_module already exists" AS message');
PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;
