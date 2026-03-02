-- Migração: Módulos, Permissões e Controle por role_id
-- Zerar permissões de todos exceto usuário id 2 (igor sotolani)
-- Executa com: mysql -u user -p database < 042_modules_permissions_role_id.sql

USE campauto;

-- ========== 1. Tabela modules ==========
CREATE TABLE IF NOT EXISTS modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 2. Seed modules (baseado no menu) ==========
INSERT IGNORE INTO modules (`key`, label, description) VALUES
  ('dashboard', 'Dashboard', 'Mapa do sistema e visão geral'),
  ('vendas', 'Vendas', 'Módulo de vendas, orçamentos e pedidos'),
  ('clientes', 'Clientes', 'Clientes físicos, jurídicos e veículos'),
  ('oficina', 'Oficina', 'Ordens de serviço e pátio'),
  ('estoque', 'Estoque', 'Produtos, saldos, movimentações e reservas'),
  ('financeiro', 'Financeiro', 'Contas a receber/pagar, caixa, fluxo e NF'),
  ('contabil', 'Fiscal/Contábil', 'Exportações e DRE'),
  ('relatorios', 'Relatórios', 'Relatórios de vendas, oficina, estoque e financeiro'),
  ('admin', 'Administração', 'Empresas, usuários, roles, templates e configurações'),
  ('rh', 'RH', 'Funcionários e cargos');

-- Atualizar labels/descriptions dos módulos existentes
UPDATE modules SET label = 'Dashboard', description = 'Mapa do sistema e visão geral' WHERE `key` = 'dashboard';
UPDATE modules SET label = 'Vendas', description = 'Módulo de vendas, orçamentos e pedidos' WHERE `key` = 'vendas';
UPDATE modules SET label = 'Clientes', description = 'Clientes físicos, jurídicos e veículos' WHERE `key` = 'clientes';
UPDATE modules SET label = 'Relatórios', description = 'Relatórios de vendas, oficina, estoque e financeiro' WHERE `key` = 'relatorios';

-- ========== 3. Garantir module_id em permissions ==========
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'permissions' AND column_name = 'module_id');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE permissions ADD COLUMN module_id INT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ========== 4. Inserir permissões novas (se não existirem) ==========
INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'dashboard.view', 'Visualizar dashboard', 'dashboard', id FROM modules WHERE `key` = 'dashboard' LIMIT 1;

INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'reports.read', 'Visualizar relatórios', 'relatorios', id FROM modules WHERE `key` = 'relatorios' LIMIT 1;

INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'sales.delete', 'Excluir vendas/orçamentos', 'vendas', id FROM modules WHERE `key` = 'vendas' LIMIT 1;

INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'admin.read', 'Acesso geral à administração', 'admin', id FROM modules WHERE `key` = 'admin' LIMIT 1;

-- Preencher module_id para permissões existentes (baseado em module string)
UPDATE permissions p
INNER JOIN modules m ON m.`key` = p.module
SET p.module_id = m.id
WHERE p.module_id IS NULL AND p.module IS NOT NULL;

-- FK module_id -> modules (se não existir)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema = DATABASE() AND table_name = 'permissions' AND constraint_name = 'fk_permissions_module');
SET @sql_fk = IF(@fk_exists = 0,
  'ALTER TABLE permissions ADD CONSTRAINT fk_permissions_module FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- ========== 5. Role DEV ==========
INSERT INTO roles (name, description)
VALUES ('DEV', 'Desenvolvedor - Acesso total. Única role que pode editar MASTER e configurar o sistema.')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ========== 6. Zerar permissões de TODAS as roles ==========
DELETE FROM role_permissions;

-- ========== 7. Dar TODAS as permissões APENAS à role DEV ==========
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'DEV' LIMIT 1), id FROM permissions;

-- ========== 8. Usuário id 2 = DEV (único com acesso) ==========
UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'DEV' LIMIT 1)
WHERE id = 2;
