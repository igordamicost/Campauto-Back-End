-- Migração: Apenas role_id - remover coluna role e usar só permissões
-- Autorização: role_id -> role_permissions -> permissions
-- Executa com: mysql -u user -p campauto < 047_role_id_only.sql

USE campauto;

-- ========== 1. Remover coluna role da tabela users ==========
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'role');
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE users DROP COLUMN role',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ========== 2. Permissão system.config (apenas role DEV) ==========
-- Usada para rotas de configuração do sistema: menu, módulos, permissões
INSERT IGNORE INTO permissions (`key`, description, module)
VALUES ('system.config', 'Configurar sistema (menu, módulos, permissões)', 'admin');

UPDATE permissions p INNER JOIN modules m ON m.`key` = 'admin' SET p.module_id = m.id WHERE p.`key` = 'system.config';

-- Dar system.config apenas à role DEV
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'DEV' LIMIT 1), (SELECT id FROM permissions WHERE `key` = 'system.config' LIMIT 1);
