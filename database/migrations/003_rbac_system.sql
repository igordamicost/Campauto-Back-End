-- Migração: Sistema RBAC (Roles + Permissões)
-- Executa com: mysql -u user -p database < 003_rbac_system.sql

USE campauto;

-- 1) Tabela de Roles
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Tabela de Permissões
CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(100) NOT NULL UNIQUE COMMENT 'Ex: stock.read, sales.create',
  description TEXT NULL,
  module VARCHAR(50) NULL COMMENT 'Agrupa permissões por módulo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) Tabela de associação Role-Permission
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  INDEX idx_role (role_id),
  INDEX idx_permission (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) Atualizar tabela users para usar role_id ao invés de role ENUM
-- Primeiro, adicionar coluna role_id (nullable temporariamente)
-- Nota: MySQL não suporta IF NOT EXISTS em ALTER TABLE, então verificamos antes
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'role_id');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE users ADD COLUMN role_id INT NULL AFTER role', 
  'SELECT "Column role_id already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Criar índice para role_id (se não existir)
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_role_id');
SET @sql_idx = IF(@idx_exists = 0, 
  'CREATE INDEX idx_users_role_id ON users(role_id)', 
  'SELECT "Index idx_users_role_id already exists" AS message');
PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- Adicionar foreign key após criar roles
-- (será feito após inserir roles iniciais)

-- Inserir roles padrão
INSERT INTO roles (id, name, description) VALUES
  (1, 'MASTER', 'Acesso total ao sistema'),
  (2, 'ADMIN', 'Administrador com acesso amplo'),
  (3, 'USER', 'Usuário padrão'),
  (4, 'ALMOX', 'Almoxarifado/Estoque'),
  (5, 'CONTAB', 'Contábil')
ON DUPLICATE KEY UPDATE name=name;

-- Inserir permissões por módulo
INSERT INTO permissions (`key`, description, module) VALUES
  -- Vendas
  ('sales.read', 'Visualizar vendas', 'vendas'),
  ('sales.create', 'Criar vendas', 'vendas'),
  ('sales.update', 'Editar vendas', 'vendas'),
  ('commissions.read', 'Visualizar comissões', 'vendas'),
  ('reports.my_sales.read', 'Visualizar minhas vendas', 'vendas'),
  
  -- Oficina
  ('service_orders.read', 'Visualizar ordens de serviço', 'oficina'),
  ('service_orders.create', 'Criar ordens de serviço', 'oficina'),
  ('service_orders.update', 'Editar ordens de serviço', 'oficina'),
  ('checklists.read', 'Visualizar checklists', 'oficina'),
  ('checklists.update', 'Editar checklists', 'oficina'),
  
  -- Estoque
  ('stock.read', 'Visualizar estoque', 'estoque'),
  ('stock.move', 'Movimentar estoque', 'estoque'),
  ('stock.reserve.create', 'Criar reservas', 'estoque'),
  ('stock.reserve.update', 'Editar reservas', 'estoque'),
  ('stock.reserve.cancel', 'Cancelar reservas', 'estoque'),
  ('stock.inventory', 'Realizar inventário', 'estoque'),
  
  -- Financeiro
  ('finance.read', 'Visualizar financeiro', 'financeiro'),
  ('finance.create', 'Criar lançamentos financeiros', 'financeiro'),
  ('finance.update', 'Editar lançamentos financeiros', 'financeiro'),
  
  -- RH/Pessoas
  ('hr.read', 'Visualizar RH', 'rh'),
  ('hr.create', 'Criar registros de RH', 'rh'),
  ('hr.update', 'Editar registros de RH', 'rh'),
  
  -- Contábil
  ('accounting.read', 'Visualizar contábil', 'contabil'),
  ('accounting.export', 'Exportar dados contábeis', 'contabil'),
  
  -- Admin
  ('admin.users.manage', 'Gerenciar usuários', 'admin'),
  ('admin.roles.manage', 'Gerenciar roles', 'admin'),
  ('admin.companies.manage', 'Gerenciar empresas', 'admin'),
  ('admin.templates.manage', 'Gerenciar templates', 'admin'),
  ('admin.integrations.manage', 'Gerenciar integrações', 'admin')
ON DUPLICATE KEY UPDATE `key`=`key`;

-- Atribuir permissões às roles
-- MASTER: todas as permissões
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions
ON DUPLICATE KEY UPDATE role_id=role_id;

-- ADMIN: todas exceto admin.users.manage (apenas MASTER)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE `key` != 'admin.users.manage'
ON DUPLICATE KEY UPDATE role_id=role_id;

-- USER: vendas (read/create), relatórios próprios, reservas básicas
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions 
WHERE `key` IN (
  'sales.read', 'sales.create', 'reports.my_sales.read',
  'commissions.read', 'stock.read', 'stock.reserve.create'
)
ON DUPLICATE KEY UPDATE role_id=role_id;

-- ALMOX: tudo de estoque
INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, id FROM permissions 
WHERE module = 'estoque'
ON DUPLICATE KEY UPDATE role_id=role_id;

-- CONTAB: contábil e financeiro (read)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 5, id FROM permissions 
WHERE (module = 'contabil' OR (module = 'financeiro' AND `key` LIKE '%.read')) OR `key` LIKE '%.export'
ON DUPLICATE KEY UPDATE role_id=role_id;

-- Migrar users existentes: MASTER -> role_id=1, USER -> role_id=3
UPDATE users SET role_id = 1 WHERE role = 'MASTER' AND role_id IS NULL;
UPDATE users SET role_id = 3 WHERE role = 'USER' AND role_id IS NULL;
UPDATE users SET role_id = 3 WHERE role_id IS NULL; -- default para USER

-- Adicionar foreign key após migração (se não existir)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.table_constraints 
  WHERE table_schema = DATABASE() AND table_name = 'users' AND constraint_name = 'fk_users_role');
SET @sql_fk = IF(@fk_exists = 0, 
  'ALTER TABLE users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL', 
  'SELECT "Foreign key fk_users_role already exists" AS message');
PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- Tornar role_id NOT NULL após migração (opcional, pode manter nullable)
-- ALTER TABLE users MODIFY COLUMN role_id INT NOT NULL;
