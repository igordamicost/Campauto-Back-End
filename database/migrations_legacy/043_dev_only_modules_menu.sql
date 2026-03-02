-- Migração: Apenas DEV com acesso, popular modules e module_id
-- Todos os usuários exceto DEV perdem permissões
-- Executa com: mysql -u user -p database < 043_dev_only_modules_menu.sql

USE campauto;

-- ========== 1. Garantir tabela modules ==========
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
  ('vendas', 'Vendas', 'Vendas, orçamentos e pedidos'),
  ('clientes', 'Clientes', 'Clientes físicos, jurídicos e veículos'),
  ('oficina', 'Oficina', 'Ordens de serviço e pátio'),
  ('estoque', 'Estoque', 'Produtos, saldos, movimentações e reservas'),
  ('financeiro', 'Financeiro', 'Contas a receber/pagar, caixa, fluxo e NF'),
  ('contabil', 'Fiscal/Contábil', 'Exportações e DRE'),
  ('relatorios', 'Relatórios', 'Relatórios de vendas, oficina, estoque e financeiro'),
  ('admin', 'Administração', 'Empresas, usuários, roles, templates e configurações'),
  ('rh', 'RH', 'Funcionários e cargos');

-- ========== 3. Garantir module_id em permissions ==========
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'permissions' AND column_name = 'module_id');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE permissions ADD COLUMN module_id INT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ========== 4. Preencher module_id em permissions (baseado em module string) ==========
UPDATE permissions p
INNER JOIN modules m ON m.`key` = p.module
SET p.module_id = m.id
WHERE p.module IS NOT NULL;

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
