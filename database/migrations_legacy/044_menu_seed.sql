-- Migração: Seed do menu (baseado no menuConfig do frontend)
-- Executa com: mysql -u user -p database < 044_menu_seed.sql

USE campauto;

-- Limpar menu existente (desabilitar FK para truncate com self-reference)
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM menu_items;
SET FOREIGN_KEY_CHECKS = 1;

-- Nível 1: Raiz
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete) VALUES
(NULL, 'dashboard', 'Mapa do Sistema', '/dashboard', 'LayoutDashboard', 0, 'dashboard.view', NULL, NULL, NULL, NULL),
(NULL, 'vendas', 'Vendas', NULL, 'ShoppingCart', 1, 'sales.read', 'sales.create', 'sales.update', 'sales.update', 'sales.delete'),
(NULL, 'clientes', 'Clientes', NULL, 'UserCircle', 2, 'sales.read', 'sales.create', 'sales.update', 'sales.update', NULL),
(NULL, 'oficina', 'Oficina', NULL, 'Wrench', 3, 'service_orders.read', 'service_orders.create', 'service_orders.update', NULL, NULL),
(NULL, 'estoque', 'Estoque', NULL, 'Package', 4, 'stock.read', 'stock.move', 'stock.reserve.update', NULL, 'stock.reserve.cancel'),
(NULL, 'financeiro', 'Financeiro', NULL, 'DollarSign', 5, 'finance.read', 'finance.create', 'finance.update', NULL, NULL),
(NULL, 'contabil', 'Fiscal/Contábil', NULL, 'FileText', 6, 'accounting.read', NULL, 'accounting.export', NULL, NULL),
(NULL, 'relatorios', 'Relatórios', NULL, 'BarChart3', 7, 'reports.read', NULL, NULL, NULL, NULL),
(NULL, 'vinculos', 'Vínculos', NULL, 'Link', 20, 'vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.update', 'vinculos.delete'),
(NULL, 'admin', 'Administração', NULL, 'Settings', 8, 'admin.roles.manage', NULL, NULL, NULL, NULL);

-- Nível 2: Filhos de Vendas
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'vendas', 'Orçamentos', '/dashboard/vendas/orcamentos', 'FileCheck', 0, 'sales.read', 'sales.create', 'sales.update', 'sales.update', NULL FROM menu_items WHERE module_key = 'vendas' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'vendas', 'Pedidos/Vendas', '/dashboard/vendas/pedidos', 'ShoppingBag', 1, 'sales.read', 'sales.create', 'sales.update', NULL, NULL FROM menu_items WHERE module_key = 'vendas' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'vendas', 'Meu Desempenho', '/dashboard/vendas/desempenho', 'BarChart3', 2, 'reports.my_sales.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'vendas' AND parent_id IS NULL LIMIT 1;

-- Nível 2: Filhos de Clientes
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'clientes', 'Clientes Físicos', '/dashboard/clientes/fisicos', 'UserCircle', 0, 'sales.read', 'sales.create', 'sales.update', NULL, NULL FROM menu_items WHERE module_key = 'clientes' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'clientes', 'Clientes Jurídicos', '/dashboard/clientes/juridicos', 'Building2', 1, 'sales.read', 'sales.create', 'sales.update', NULL, NULL FROM menu_items WHERE module_key = 'clientes' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'clientes', 'Veículos', '/dashboard/clientes/veiculos', 'Car', 2, 'sales.read', 'sales.create', 'sales.update', NULL, NULL FROM menu_items WHERE module_key = 'clientes' AND parent_id IS NULL LIMIT 1;

-- Nível 2: Filhos de Oficina
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'oficina', 'Pátio', '/dashboard/oficina/patio', 'LayoutDashboard', 0, 'service_orders.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'oficina' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'oficina', 'Ordens de Serviço (OS)', '/dashboard/oficina/os', 'ClipboardList', 1, 'service_orders.read', 'service_orders.create', 'service_orders.update', NULL, NULL FROM menu_items WHERE module_key = 'oficina' AND parent_id IS NULL LIMIT 1;

-- Nível 2: Filhos de Estoque
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

-- Nível 2: Filhos de Financeiro
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

-- Nível 2: Filhos de Fiscal/Contábil
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'contabil', 'Exportações', '/dashboard/fiscal/exportacoes', 'FileText', 0, 'accounting.export', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'contabil' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'contabil', 'Resumos / DRE', '/dashboard/fiscal/dre', 'BarChart3', 1, 'accounting.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'contabil' AND parent_id IS NULL LIMIT 1;

-- Nível 2: Filhos de Vínculos
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'vinculos', 'Vínculos de Produtos', '/dashboard/vinculos/produtos', 'Link', 0, 'vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.update', 'vinculos.delete' FROM menu_items WHERE module_key = 'vinculos' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'vinculos', 'Fábricas', '/dashboard/vinculos/fabricas', 'Building2', 1, 'vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.update', 'vinculos.delete' FROM menu_items WHERE module_key = 'vinculos' AND parent_id IS NULL LIMIT 1;

-- Nível 2: Filhos de Relatórios
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'relatorios', 'Vendas', '/dashboard/relatorios/vendas', 'ShoppingCart', 0, 'reports.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'relatorios' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'relatorios', 'Oficina', '/dashboard/relatorios/oficina', 'Wrench', 1, 'reports.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'relatorios' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'relatorios', 'Estoque', '/dashboard/relatorios/estoque', 'Package', 2, 'reports.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'relatorios' AND parent_id IS NULL LIMIT 1;
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT id, 'relatorios', 'Financeiro', '/dashboard/relatorios/financeiro', 'DollarSign', 3, 'reports.read', NULL, NULL, NULL, NULL FROM menu_items WHERE module_key = 'relatorios' AND parent_id IS NULL LIMIT 1;

-- Nível 2: Filhos de Administração
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
