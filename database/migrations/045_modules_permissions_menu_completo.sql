-- Migração: Módulos, Permissões, Menu e DEV-only (consolidado)
-- Baseado no prompt de arquitetura RBAC
-- Executa com: mysql -u user -p database < 045_modules_permissions_menu_completo.sql
-- Ordem: executar após 043 e 044 (ou em ambiente limpo)

USE campauto;

-- ========== 1. Adicionar icon e order em modules ==========
SET @col_icon = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'modules' AND column_name = 'icon');
SET @sql_icon = IF(@col_icon = 0,
  'ALTER TABLE modules ADD COLUMN icon VARCHAR(50) NULL AFTER description',
  'SELECT 1');
PREPARE stmt FROM @sql_icon;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_order = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'modules' AND column_name = 'order');
SET @sql_order = IF(@col_order = 0,
  'ALTER TABLE modules ADD COLUMN `order` INT DEFAULT 0 AFTER icon',
  'SELECT 1');
PREPARE stmt FROM @sql_order;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ========== 2. Seed modules com icon e order ==========
UPDATE modules SET icon = 'LayoutDashboard', `order` = 0 WHERE `key` = 'dashboard';
UPDATE modules SET icon = 'ShoppingCart', `order` = 1 WHERE `key` = 'vendas';
UPDATE modules SET icon = 'UserCircle', `order` = 2 WHERE `key` = 'clientes';
UPDATE modules SET icon = 'Wrench', `order` = 3 WHERE `key` = 'oficina';
UPDATE modules SET icon = 'Package', `order` = 4 WHERE `key` = 'estoque';
UPDATE modules SET icon = 'DollarSign', `order` = 5 WHERE `key` = 'financeiro';
UPDATE modules SET icon = 'FileText', `order` = 6 WHERE `key` = 'contabil';
UPDATE modules SET icon = 'BarChart3', `order` = 7 WHERE `key` = 'relatorios';
UPDATE modules SET icon = 'Settings', `order` = 8 WHERE `key` = 'admin';
UPDATE modules SET icon = 'Users', `order` = 9 WHERE `key` = 'rh';

-- Inserir módulos faltantes
INSERT IGNORE INTO modules (`key`, label, description, icon, `order`) VALUES
  ('dashboard', 'Dashboard', 'Mapa do sistema', 'LayoutDashboard', 0),
  ('clientes', 'Clientes', 'Clientes e veículos', 'UserCircle', 2),
  ('estoque', 'Estoque', 'Produtos e movimentações', 'Package', 4),
  ('contabil', 'Fiscal/Contábil', 'Exportações e DRE', 'FileText', 6),
  ('relatorios', 'Relatórios', 'Relatórios gerais', 'BarChart3', 7);

-- ========== 3. Inserir permissões faltantes ==========
INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'dashboard.view', 'Visualizar dashboard', 'dashboard', id FROM modules WHERE `key` = 'dashboard' LIMIT 1;

INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'reports.read', 'Visualizar relatórios', 'relatorios', id FROM modules WHERE `key` = 'relatorios' LIMIT 1;

INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'sales.delete', 'Excluir vendas/orçamentos', 'vendas', id FROM modules WHERE `key` = 'vendas' LIMIT 1;

INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'admin.read', 'Acesso geral à administração', 'admin', id FROM modules WHERE `key` = 'admin' LIMIT 1;

-- Preencher module_id para todas as permissões
UPDATE permissions p
INNER JOIN modules m ON m.`key` = p.module
SET p.module_id = m.id
WHERE p.module IS NOT NULL;

-- ========== 4. Role DEV ==========
INSERT INTO roles (name, description)
VALUES ('DEV', 'Desenvolvedor - Acesso total. Única role que pode editar MASTER e configurar o sistema.')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ========== 5. Zerar permissões de TODAS as roles ==========
DELETE FROM role_permissions;

-- ========== 6. Dar TODAS as permissões APENAS à role DEV ==========
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'DEV' LIMIT 1), id FROM permissions;

-- ========== 7. Usuário id 2 = DEV (único com acesso total) ==========
UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'DEV' LIMIT 1)
WHERE id = 2;
