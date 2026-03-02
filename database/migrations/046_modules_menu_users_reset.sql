-- Migração: Módulos, Menu e Reset de Usuários
-- 1. Garante todos os módulos cadastrados
-- 2. Preenche module_id em permissions
-- 3. Seed completo do menu
-- 4. Remove todos os usuários exceto id 2 (igor sotolani)
-- Executa com: mysql -u user -p campauto < 046_modules_menu_users_reset.sql

USE campauto;

-- ========== 1. MÓDULOS ==========
CREATE TABLE IF NOT EXISTS modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  description TEXT NULL,
  icon VARCHAR(50) NULL,
  `order` INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Adicionar icon e order se não existirem
SET @col_icon = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'modules' AND column_name = 'icon');
SET @sql = IF(@col_icon = 0, 'ALTER TABLE modules ADD COLUMN icon VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_order = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'modules' AND column_name = 'order');
SET @sql = IF(@col_order = 0, 'ALTER TABLE modules ADD COLUMN `order` INT DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Seed módulos (todos os do sistema)
INSERT INTO modules (`key`, label, description, icon, `order`) VALUES
  ('dashboard', 'Dashboard', 'Mapa do sistema', 'LayoutDashboard', 0),
  ('vendas', 'Vendas', 'Vendas, orçamentos e pedidos', 'ShoppingCart', 1),
  ('clientes', 'Clientes', 'Clientes e veículos', 'UserCircle', 2),
  ('oficina', 'Oficina', 'Ordens de serviço', 'Wrench', 3),
  ('estoque', 'Estoque', 'Produtos e movimentações', 'Package', 4),
  ('financeiro', 'Financeiro', 'Financeiro e NF', 'DollarSign', 5),
  ('contabil', 'Fiscal/Contábil', 'Exportações e DRE', 'FileText', 6),
  ('relatorios', 'Relatórios', 'Relatórios gerais', 'BarChart3', 7),
  ('admin', 'Administração', 'Configurações do sistema', 'Settings', 8),
  ('rh', 'RH', 'Funcionários e cargos', 'Users', 9)
ON DUPLICATE KEY UPDATE label = VALUES(label), description = VALUES(description), icon = VALUES(icon), `order` = VALUES(`order`);

-- ========== 2. MODULE_ID EM PERMISSIONS ==========
SET @col_mid = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'permissions' AND column_name = 'module_id');
SET @sql = IF(@col_mid = 0, 'ALTER TABLE permissions ADD COLUMN module_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE permissions p
INNER JOIN modules m ON m.`key` = p.module
SET p.module_id = m.id
WHERE p.module IS NOT NULL;

-- ========== 3. MENU_ITEMS (seed completo) ==========
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM menu_items;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete) VALUES
(NULL, 'dashboard', 'Mapa do Sistema', '/dashboard', 'LayoutDashboard', 0, 'dashboard.view', NULL, NULL, NULL, NULL),
(NULL, 'vendas', 'Vendas', NULL, 'ShoppingCart', 1, 'sales.read', 'sales.create', 'sales.update', 'sales.update', 'sales.delete'),
(NULL, 'clientes', 'Clientes', NULL, 'UserCircle', 2, 'sales.read', 'sales.create', 'sales.update', 'sales.update', NULL),
(NULL, 'oficina', 'Oficina', NULL, 'Wrench', 3, 'service_orders.read', 'service_orders.create', 'service_orders.update', NULL, NULL),
(NULL, 'estoque', 'Estoque', NULL, 'Package', 4, 'stock.read', 'stock.move', 'stock.reserve.update', NULL, 'stock.reserve.cancel'),
(NULL, 'financeiro', 'Financeiro', NULL, 'DollarSign', 5, 'finance.read', 'finance.create', 'finance.update', NULL, NULL),
(NULL, 'contabil', 'Fiscal/Contábil', NULL, 'FileText', 6, 'accounting.read', NULL, 'accounting.export', NULL, NULL),
(NULL, 'relatorios', 'Relatórios', NULL, 'BarChart3', 7, 'reports.read', NULL, NULL, NULL, NULL),
(NULL, 'admin', 'Administração', NULL, 'Settings', 8, 'admin.roles.manage', NULL, NULL, NULL, NULL);

-- Filhos de Vendas
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'vendas', 'Orçamentos', '/dashboard/vendas/orcamentos', 'FileCheck', 0, 'sales.read', 'sales.create', 'sales.update', 'sales.update', NULL FROM menu_items WHERE module_key = 'vendas' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'vendas', 'Pedidos/Vendas', '/dashboard/vendas/pedidos', 'ShoppingBag', 1, 'sales.read', 'sales.create', 'sales.update', NULL, NULL FROM menu_items WHERE module_key = 'vendas' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'vendas', 'Meu Desempenho', '/dashboard/vendas/desempenho', 'BarChart3', 2, 'reports.my_sales.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'vendas' AND parent_id IS NULL LIMIT 1;

-- Filhos de Clientes
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'clientes', 'Clientes Físicos', '/dashboard/clientes/fisicos', 'UserCircle', 0, 'sales.read', 'sales.create', 'sales.update', NULL, NULL FROM menu_items WHERE module_key = 'clientes' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'clientes', 'Clientes Jurídicos', '/dashboard/clientes/juridicos', 'Building2', 1, 'sales.read', 'sales.create', 'sales.update', NULL, NULL FROM menu_items WHERE module_key = 'clientes' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'clientes', 'Veículos', '/dashboard/clientes/veiculos', 'Car', 2, 'sales.read', 'sales.create', 'sales.update', NULL, NULL FROM menu_items WHERE module_key = 'clientes' AND parent_id IS NULL LIMIT 1;

-- Filhos de Oficina
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'oficina', 'Pátio', '/dashboard/oficina/patio', 'LayoutDashboard', 0, 'service_orders.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'oficina' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'oficina', 'Ordens de Serviço (OS)', '/dashboard/oficina/os', 'ClipboardList', 1, 'service_orders.read', 'service_orders.create', 'service_orders.update', NULL, NULL FROM menu_items WHERE module_key = 'oficina' AND parent_id IS NULL LIMIT 1;

-- Filhos de Estoque
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'estoque', 'Produtos', '/dashboard/estoque/produtos', 'Boxes', 0, 'stock.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'estoque' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'estoque', 'Estoque / Saldos', '/dashboard/estoque/saldos', 'PackageSearch', 1, 'stock.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'estoque' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'estoque', 'Adicionar ao estoque', '/dashboard/estoque/entrada', 'PackagePlus', 2, 'stock.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'estoque' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'estoque', 'Movimentações', '/dashboard/estoque/movimentacoes', 'ArrowUpDown', 3, 'stock.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'estoque' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'estoque', 'Reservas de Peça', '/dashboard/estoque/reservas', 'Calendar', 4, 'stock.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'estoque' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'estoque', 'Pedidos de Compra', '/dashboard/estoque/compras', 'ShoppingBag', 5, 'stock.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'estoque' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'estoque', 'Fornecedores', '/dashboard/estoque/fornecedores', 'Truck', 6, 'stock.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'estoque' AND parent_id IS NULL LIMIT 1;

-- Filhos de Financeiro
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'financeiro', 'Contas a Receber', '/dashboard/financeiro/receber', 'Receipt', 0, 'finance.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'financeiro' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'financeiro', 'Contas a Pagar', '/dashboard/financeiro/pagar', 'CreditCard', 1, 'finance.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'financeiro' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'financeiro', 'Caixa/Bancos', '/dashboard/financeiro/caixa', 'Wallet', 2, 'finance.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'financeiro' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'financeiro', 'Fluxo de Caixa', '/dashboard/financeiro/fluxo', 'TrendingUp', 3, 'finance.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'financeiro' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'financeiro', 'Emitir Nota Fiscal', '/dashboard/financeiro/nota-fiscal/emitir', 'FilePlus', 4, 'finance.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'financeiro' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'financeiro', 'Buscar Nota Fiscal', '/dashboard/financeiro/nota-fiscal/buscar', 'Search', 5, 'finance.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'financeiro' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'financeiro', 'Cancelar Nota Fiscal', '/dashboard/financeiro/nota-fiscal/cancelar', 'FileX', 6, 'finance.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'financeiro' AND parent_id IS NULL LIMIT 1;

-- Filhos de Fiscal/Contábil
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'contabil', 'Exportações', '/dashboard/fiscal/exportacoes', 'FileText', 0, 'accounting.export', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'contabil' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'contabil', 'Resumos / DRE', '/dashboard/fiscal/dre', 'BarChart3', 1, 'accounting.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'contabil' AND parent_id IS NULL LIMIT 1;

-- Filhos de Relatórios
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'relatorios', 'Vendas', '/dashboard/relatorios/vendas', 'ShoppingCart', 0, 'reports.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'relatorios' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'relatorios', 'Oficina', '/dashboard/relatorios/oficina', 'Wrench', 1, 'reports.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'relatorios' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'relatorios', 'Estoque', '/dashboard/relatorios/estoque', 'Package', 2, 'reports.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'relatorios' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'relatorios', 'Financeiro', '/dashboard/relatorios/financeiro', 'DollarSign', 3, 'reports.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'relatorios' AND parent_id IS NULL LIMIT 1;

-- Filhos de Administração
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'admin', 'Empresas', '/dashboard/administracao/empresas', 'Building2', 0, 'admin.companies.manage', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'admin' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'admin', 'Usuários e Acessos', '/dashboard/administracao/usuarios', 'Users', 1, 'admin.users.manage', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'admin' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'admin', 'Roles e Permissões', '/dashboard/administracao/roles', 'Shield', 2, 'admin.roles.manage', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'admin' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'admin', 'Templates de E-mail', '/dashboard/administracao/templates', 'Mail', 3, 'admin.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'admin' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'admin', 'Configurações Gerais', '/dashboard/administracao/config', 'Settings', 4, 'admin.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'admin' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'admin', 'Serviços', '/dashboard/administracao/servicos', 'FileText', 5, 'admin.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'admin' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'admin', 'Elevadores', '/dashboard/administracao/elevadores', 'Layers', 6, 'admin.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'admin' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'admin', 'Pessoas (RH) - Funcionários', '/dashboard/pessoas/funcionarios', 'UserCircle', 7, 'hr.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'admin' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'admin', 'Pessoas (RH) - Cargos/Permissões', '/dashboard/pessoas/cargos', 'Settings', 8, 'hr.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'admin' AND parent_id IS NULL LIMIT 1;

-- ========== 4. REMOVER USUÁRIOS (exceto id 2) ==========
-- Redirecionar referências para o usuário 2 antes de deletar
SET @keep_user = 2;

-- Tabelas com RESTRICT: atualizar para usuário 2 (ignorar erros se tabela/coluna não existir)
UPDATE reservations SET salesperson_user_id = @keep_user WHERE salesperson_user_id != @keep_user AND salesperson_user_id IS NOT NULL;
UPDATE reservations SET created_by = @keep_user WHERE created_by != @keep_user AND created_by IS NOT NULL;
UPDATE reservation_events SET created_by = @keep_user WHERE created_by != @keep_user AND created_by IS NOT NULL;
UPDATE sales SET salesperson_user_id = @keep_user WHERE salesperson_user_id != @keep_user;
UPDATE commissions SET salesperson_user_id = @keep_user WHERE salesperson_user_id != @keep_user;
UPDATE commission_rules SET salesperson_user_id = @keep_user WHERE salesperson_user_id != @keep_user AND salesperson_user_id IS NOT NULL;
UPDATE commission_rules SET created_by = @keep_user WHERE created_by != @keep_user;
UPDATE caixa_movimentacoes SET usuario_id = @keep_user WHERE usuario_id != @keep_user;
UPDATE pedidos_compra SET usuario_id = @keep_user WHERE usuario_id != @keep_user;
UPDATE compras SET usuario_id = @keep_user WHERE usuario_id != @keep_user;
UPDATE contas_receber SET usuario_id = @keep_user WHERE usuario_id != @keep_user;
UPDATE contas_pagar SET usuario_id = @keep_user WHERE usuario_id != @keep_user;
UPDATE orcamentos_servico SET usuario_id = @keep_user WHERE usuario_id != @keep_user;
UPDATE oficina_os SET usuario_id = @keep_user WHERE usuario_id != @keep_user;
UPDATE os_checklists SET responsavel_id = @keep_user WHERE responsavel_id != @keep_user AND responsavel_id IS NOT NULL;

-- Tabelas com CASCADE: serão limpas ao deletar (auth_sessions, password_tokens, notifications)
-- Deletar usuários exceto id 2
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM auth_sessions WHERE user_id != @keep_user;
DELETE FROM password_reset_tokens WHERE user_id != @keep_user;
DELETE FROM notifications WHERE user_id != @keep_user;
DELETE FROM notification_sent_log WHERE user_id != @keep_user;
DELETE FROM users WHERE id != @keep_user;
SET FOREIGN_KEY_CHECKS = 1;

-- Garantir usuário 2 = role DEV
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'DEV' LIMIT 1) WHERE id = @keep_user;
