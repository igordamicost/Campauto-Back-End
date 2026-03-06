-- Migration consolidada - gerada por build-migration.js
-- Contém todas as alterações de 001 a 056
-- Executada pelo MigrationService com logs por etapa

USE campauto;

-- ========== STEP: 001_google_mail_integrations_password_tokens ==========
-- Migração: Integração Gmail API + tokens de senha
-- Executa com: mysql -u user -p database < 001_google_mail_integrations_password_tokens.sql

-- A) google_mail_integrations
CREATE TABLE IF NOT EXISTS google_mail_integrations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_master_user_id BIGINT NOT NULL,
  sender_email VARCHAR(255) NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  client_secret_enc TEXT NOT NULL,
  client_secret_iv VARBINARY(16) NOT NULL,
  client_secret_tag VARBINARY(16) NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  refresh_token_iv VARBINARY(16) NOT NULL,
  refresh_token_tag VARBINARY(16) NOT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  last_tested_at DATETIME NULL,
  last_error TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_owner (owner_master_user_id),
  CONSTRAINT fk_gmail_owner FOREIGN KEY (owner_master_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- B) password_reset_tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  type ENUM('FIRST_ACCESS','RESET') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_type (user_id, type),
  UNIQUE KEY uniq_token_hash (token_hash),
  CONSTRAINT fk_pwd_token_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- C) users: permitir password NULL + must_set_password
-- Nota: must_set_password será adicionada pelo seed (ensureColumns) se não existir
ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL;

-- ========== STEP: 002_email_templates ==========
-- Migração: Templates de e-mail HTML
-- Executa com: mysql -u user -p campauto < 002_email_templates.sql

CREATE TABLE IF NOT EXISTS email_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  owner_master_user_id INT NOT NULL,
  template_key ENUM('FIRST_ACCESS','RESET') NOT NULL,
  name VARCHAR(120) NOT NULL,
  subject VARCHAR(160) NOT NULL,
  html_body MEDIUMTEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_owner_key (owner_master_user_id, template_key),
  CONSTRAINT fk_email_tpl_owner FOREIGN KEY (owner_master_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 003_rbac_system ==========
-- Migração: Sistema RBAC (Roles + Permissões)
-- Executa com: mysql -u user -p database < 003_rbac_system.sql

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
SET @has_role = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'role');
SET @sql = IF(@col_exists = 0, 
  CONCAT('ALTER TABLE users ADD COLUMN role_id INT NULL AFTER ', IF(@has_role > 0, 'role', 'password')), 
  'SELECT 1');
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

-- Migrar users existentes (só se coluna role existir; setup novo já usa só role_id)
SET @has_role = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'role');
SET @sql1 = IF(@has_role > 0, 'UPDATE users SET role_id = 1 WHERE role = ''MASTER'' AND role_id IS NULL', 'SELECT 1');
PREPARE s1 FROM @sql1; EXECUTE s1; DEALLOCATE PREPARE s1;
SET @sql2 = IF(@has_role > 0, 'UPDATE users SET role_id = 3 WHERE role = ''USER'' AND role_id IS NULL', 'SELECT 1');
PREPARE s2 FROM @sql2; EXECUTE s2; DEALLOCATE PREPARE s2;
UPDATE users SET role_id = 3 WHERE role_id IS NULL;

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

-- ========== STEP: 004_stock_system ==========
-- Migração: Sistema de Estoque
-- Executa com: mysql -u user -p database < 004_stock_system.sql

-- 1) Tabela de Localizações de Estoque (opcional, para multi-armazém)
CREATE TABLE IF NOT EXISTS stock_locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inserir localização padrão
INSERT INTO stock_locations (id, name, code, description) VALUES
  (1, 'Estoque Principal', 'MAIN', 'Localização padrão do estoque')
ON DUPLICATE KEY UPDATE name=name;

-- 2) Tabela de Saldos de Estoque
CREATE TABLE IF NOT EXISTS stock_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  location_id INT NOT NULL DEFAULT 1,
  qty_on_hand DECIMAL(10,3) NOT NULL DEFAULT 0.000 COMMENT 'Quantidade física disponível',
  qty_reserved DECIMAL(10,3) NOT NULL DEFAULT 0.000 COMMENT 'Quantidade reservada',
  qty_available DECIMAL(10,3) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED COMMENT 'Quantidade disponível (calculada)',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_product_location (product_id, location_id),
  CONSTRAINT fk_sb_product FOREIGN KEY (product_id) REFERENCES produtos(id) ON DELETE CASCADE,
  CONSTRAINT fk_sb_location FOREIGN KEY (location_id) REFERENCES stock_locations(id) ON DELETE RESTRICT,
  INDEX idx_product (product_id),
  INDEX idx_location (location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) Tabela de Movimentações de Estoque
CREATE TABLE IF NOT EXISTS stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  location_id INT NOT NULL DEFAULT 1,
  type ENUM('ENTRY','EXIT','ADJUSTMENT','RESERVE','RESERVE_RETURN','RESERVE_CONVERT') NOT NULL,
  qty DECIMAL(10,3) NOT NULL,
  qty_before DECIMAL(10,3) NULL COMMENT 'Quantidade antes da movimentação',
  qty_after DECIMAL(10,3) NULL COMMENT 'Quantidade depois da movimentação',
  ref_type VARCHAR(50) NULL COMMENT 'Tipo de referência: SALE, RESERVATION, ADJUSTMENT, etc',
  ref_id INT NULL COMMENT 'ID da referência (sale_id, reservation_id, etc)',
  notes TEXT NULL,
  created_by INT NULL COMMENT 'user_id que criou a movimentação',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sm_product FOREIGN KEY (product_id) REFERENCES produtos(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sm_location FOREIGN KEY (location_id) REFERENCES stock_locations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sm_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_product (product_id),
  INDEX idx_location (location_id),
  INDEX idx_type (type),
  INDEX idx_ref (ref_type, ref_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 005_reservations_system ==========
-- Migração: Sistema de Reservas de Peças
-- Executa com: mysql -u user -p database < 005_reservations_system.sql

-- 1) Tabela de Reservas
CREATE TABLE IF NOT EXISTS reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  customer_id INT NULL COMMENT 'cliente_id da tabela clientes',
  salesperson_user_id INT NOT NULL COMMENT 'vendedor responsável',
  location_id INT NOT NULL DEFAULT 1,
  qty DECIMAL(10,3) NOT NULL,
  status ENUM('ACTIVE','DUE_SOON','OVERDUE','RETURNED','CANCELED','CONVERTED') NOT NULL DEFAULT 'ACTIVE',
  reserved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at DATETIME NOT NULL COMMENT 'Data/hora limite para devolução',
  returned_at DATETIME NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_res_product FOREIGN KEY (product_id) REFERENCES produtos(id) ON DELETE RESTRICT,
  CONSTRAINT fk_res_customer FOREIGN KEY (customer_id) REFERENCES clientes(id) ON DELETE SET NULL,
  CONSTRAINT fk_res_salesperson FOREIGN KEY (salesperson_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_res_location FOREIGN KEY (location_id) REFERENCES stock_locations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_res_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_product (product_id),
  INDEX idx_customer (customer_id),
  INDEX idx_salesperson (salesperson_user_id),
  INDEX idx_status (status),
  INDEX idx_due_at (due_at),
  INDEX idx_reserved_at (reserved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Tabela de Eventos/Logs de Reserva (auditoria)
CREATE TABLE IF NOT EXISTS reservation_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT NOT NULL,
  event_type ENUM('CREATED','UPDATED','STATUS_CHANGED','RETURNED','CANCELED','CONVERTED','NOTIFICATION_SENT') NOT NULL,
  old_status VARCHAR(50) NULL,
  new_status VARCHAR(50) NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_re_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  CONSTRAINT fk_re_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_reservation (reservation_id),
  INDEX idx_event_type (event_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 006_sales_commissions ==========
-- Migração: Sistema de Vendas e Comissões
-- Executa com: mysql -u user -p database < 006_sales_commissions.sql

-- 1) Tabela de Vendas
CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NULL,
  salesperson_user_id INT NOT NULL COMMENT 'vendedor responsável',
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status ENUM('PENDING','CONFIRMED','CANCELED','DELIVERED') NOT NULL DEFAULT 'PENDING',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sale_customer FOREIGN KEY (customer_id) REFERENCES clientes(id) ON DELETE SET NULL,
  CONSTRAINT fk_sale_salesperson FOREIGN KEY (salesperson_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_customer (customer_id),
  INDEX idx_salesperson (salesperson_user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Tabela de Itens de Venda
CREATE TABLE IF NOT EXISTS sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  product_id INT NOT NULL,
  qty DECIMAL(10,3) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  reservation_id INT NULL COMMENT 'Se veio de uma reserva',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_si_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_si_product FOREIGN KEY (product_id) REFERENCES produtos(id) ON DELETE RESTRICT,
  CONSTRAINT fk_si_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
  INDEX idx_sale (sale_id),
  INDEX idx_product (product_id),
  INDEX idx_reservation (reservation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) Tabela de Comissões (opcional, para cálculo futuro)
CREATE TABLE IF NOT EXISTS commissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  salesperson_user_id INT NOT NULL,
  base_amount DECIMAL(10,2) NOT NULL COMMENT 'Valor base para cálculo',
  commission_rate DECIMAL(5,2) NOT NULL COMMENT 'Percentual de comissão',
  commission_amount DECIMAL(10,2) NOT NULL COMMENT 'Valor da comissão',
  status ENUM('PENDING','PAID','CANCELED') NOT NULL DEFAULT 'PENDING',
  paid_at DATETIME NULL,
  period_month DATE NULL COMMENT 'Mês de referência (YYYY-MM-01)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_comm_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
  CONSTRAINT fk_comm_salesperson FOREIGN KEY (salesperson_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_sale (sale_id),
  INDEX idx_salesperson (salesperson_user_id),
  INDEX idx_status (status),
  INDEX idx_period (period_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 007_notifications ==========
-- Migração: Sistema de Notificações
-- Executa com: mysql -u user -p database < 007_notifications.sql

-- Tabela de Notificações
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT 'Usuário destinatário',
  type VARCHAR(50) NOT NULL COMMENT 'Ex: RESERVATION_DUE_SOON, RESERVATION_OVERDUE, etc',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME NULL,
  metadata JSON NULL COMMENT 'Dados adicionais (ex: reservation_id, sale_id)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela para controle de notificações enviadas (evitar duplicatas)
CREATE TABLE IF NOT EXISTS notification_sent_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT NULL,
  user_id INT NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  sent_date DATE NOT NULL COMMENT 'Data do envio (para controle diário)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_reservation_user_type_date (reservation_id, user_id, notification_type, sent_date),
  CONSTRAINT fk_nsl_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  CONSTRAINT fk_nsl_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reservation (reservation_id),
  INDEX idx_user (user_id),
  INDEX idx_sent_date (sent_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 008_produtos_preco_custo ==========
-- Migração: Coluna preco_custo na tabela produtos
-- Uso: custo do produto para exibição no orçamento (não imprime); atualizado pelo front ao editar no orçamento.
-- Executa com: mysql -u user -p database < 008_produtos_preco_custo.sql
-- Após rodar: GET/PUT /produtos passam a incluir preco_custo (a API não precisa ser reiniciada).

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'produtos' AND column_name = 'preco_custo'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE produtos ADD COLUMN preco_custo DECIMAL(10,2) NULL COMMENT ''Custo do produto (uso interno no orçamento)'' AFTER observacao',
  'SELECT ''Column preco_custo already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ========== STEP: 009_veiculos ==========
-- Veículos vinculados a clientes (para orçamentos e oficina)
CREATE TABLE IF NOT EXISTS veiculos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  marca VARCHAR(120) NULL,
  modelo VARCHAR(120) NULL,
  placa VARCHAR(20) NULL,
  ano VARCHAR(10) NULL,
  renavan VARCHAR(30) NULL,
  chassi VARCHAR(50) NULL,
  cor VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_veiculos_cliente (cliente_id),
  CONSTRAINT fk_veiculos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 010_commission_rules ==========
-- Migração: Sistema de Regras de Comissão
-- Executa com: mysql -u user -p database < 010_commission_rules.sql

-- Tabela de Regras de Comissão
CREATE TABLE IF NOT EXISTS commission_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_type ENUM('DEFAULT', 'BY_SALESPERSON', 'BY_PRODUCT', 'BY_CATEGORY') NOT NULL COMMENT 'Tipo de regra',
  salesperson_user_id INT NULL COMMENT 'ID do vendedor (se rule_type = BY_SALESPERSON)',
  product_id INT NULL COMMENT 'ID do produto (se rule_type = BY_PRODUCT)',
  category VARCHAR(100) NULL COMMENT 'Categoria do produto (se rule_type = BY_CATEGORY)',
  commission_rate DECIMAL(5,2) NOT NULL COMMENT 'Percentual de comissão (ex: 5.00 = 5%)',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Regra ativa ou não',
  priority INT NOT NULL DEFAULT 0 COMMENT 'Prioridade (maior = mais específica, aplicada primeiro)',
  created_by INT NOT NULL COMMENT 'Usuário que criou a regra',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cr_salesperson FOREIGN KEY (salesperson_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cr_product FOREIGN KEY (product_id) REFERENCES produtos(id) ON DELETE CASCADE,
  CONSTRAINT fk_cr_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_rule_type (rule_type),
  INDEX idx_salesperson (salesperson_user_id),
  INDEX idx_product (product_id),
  INDEX idx_category (category),
  INDEX idx_active (is_active),
  INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Regras de comissão configuráveis pelo MASTER';

-- Inserir regra padrão (5% de comissão)
INSERT INTO commission_rules (rule_type, commission_rate, priority, created_by, is_active)
SELECT 'DEFAULT', 5.00, 0, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM commission_rules WHERE rule_type = 'DEFAULT' AND salesperson_user_id IS NULL AND product_id IS NULL AND category IS NULL);

-- ========== STEP: 011_financeiro_contas ==========
-- Migração: Sistema Financeiro - Contas a Receber e Contas a Pagar
-- Executa com: mysql -u user -p database < 011_financeiro_contas.sql

-- 1) Tabela de Contas a Receber
CREATE TABLE IF NOT EXISTS contas_receber (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  valor DECIMAL(10,2) NOT NULL CHECK (valor > 0),
  vencimento DATE NOT NULL,
  pago BOOLEAN DEFAULT FALSE,
  data_pagamento DATE NULL,
  forma_pagamento VARCHAR(50) NULL,
  observacoes TEXT NULL,
  orcamento_id INT NULL,
  usuario_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cr_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cr_orcamento FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE SET NULL,
  CONSTRAINT fk_cr_usuario FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_cliente (cliente_id),
  INDEX idx_vencimento (vencimento),
  INDEX idx_pago (pago),
  INDEX idx_orcamento (orcamento_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Contas a receber';

-- 2) Tabela de Contas a Pagar
CREATE TABLE IF NOT EXISTS contas_pagar (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fornecedor_id INT NULL COMMENT 'ID do fornecedor (pode ser NULL para despesas genéricas)',
  descricao VARCHAR(255) NOT NULL,
  valor DECIMAL(10,2) NOT NULL CHECK (valor > 0),
  vencimento DATE NOT NULL,
  pago BOOLEAN DEFAULT FALSE,
  data_pagamento DATE NULL,
  forma_pagamento VARCHAR(50) NULL,
  observacoes TEXT NULL,
  compra_id INT NULL COMMENT 'Se vinculado a uma compra',
  usuario_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cp_usuario FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_fornecedor (fornecedor_id),
  INDEX idx_vencimento (vencimento),
  INDEX idx_pago (pago),
  INDEX idx_compra (compra_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Contas a pagar';

-- ========== STEP: 012_financeiro_caixa ==========
-- Migração: Sistema Financeiro - Caixa e Bancos
-- Executa com: mysql -u user -p database < 012_financeiro_caixa.sql

-- 1) Tabela de Contas de Caixa/Banco
CREATE TABLE IF NOT EXISTS caixa_contas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  tipo ENUM('CAIXA', 'BANCO') NOT NULL,
  banco VARCHAR(100) NULL COMMENT 'Nome do banco (se tipo=BANCO)',
  agencia VARCHAR(20) NULL COMMENT 'Agência (se tipo=BANCO)',
  conta VARCHAR(50) NULL COMMENT 'Número da conta (se tipo=BANCO)',
  saldo_inicial DECIMAL(10,2) DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tipo (tipo),
  INDEX idx_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Contas de caixa e banco';

-- 2) Tabela de Movimentações de Caixa
CREATE TABLE IF NOT EXISTS caixa_movimentacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conta_caixa_id INT NOT NULL,
  tipo ENUM('ENTRADA', 'SAIDA') NOT NULL,
  valor DECIMAL(10,2) NOT NULL CHECK (valor > 0),
  descricao VARCHAR(255) NOT NULL,
  data DATE NOT NULL,
  forma_pagamento VARCHAR(50) NULL,
  referencia_tipo VARCHAR(50) NULL COMMENT 'CONTA_RECEBER, CONTA_PAGAR, VENDA, etc',
  referencia_id INT NULL COMMENT 'ID da referência',
  usuario_id INT NOT NULL,
  observacoes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cm_conta FOREIGN KEY (conta_caixa_id) REFERENCES caixa_contas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cm_usuario FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_conta (conta_caixa_id),
  INDEX idx_data (data),
  INDEX idx_tipo (tipo),
  INDEX idx_referencia (referencia_tipo, referencia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Movimentações de caixa';

-- ========== STEP: 013_estoque_compras ==========
-- Migração: Sistema de Compras
-- Executa com: mysql -u user -p database < 013_estoque_compras.sql

-- 1) Tabela de Compras
CREATE TABLE IF NOT EXISTS compras (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero VARCHAR(50) UNIQUE NOT NULL COMMENT 'Número sequencial da compra (ex: COMP-0001)',
  fornecedor_id INT NULL COMMENT 'ID do fornecedor',
  data DATE NOT NULL,
  data_entrega DATE NULL,
  status ENUM('RASCUNHO', 'PENDENTE', 'FINALIZADA', 'CANCELADA') DEFAULT 'RASCUNHO',
  valor_total DECIMAL(10,2) DEFAULT 0,
  desconto DECIMAL(10,2) DEFAULT 0,
  observacoes TEXT NULL,
  usuario_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_comp_usuario FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_fornecedor (fornecedor_id),
  INDEX idx_data (data),
  INDEX idx_status (status),
  INDEX idx_numero (numero)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Compras de produtos';

-- 2) Tabela de Itens de Compra
CREATE TABLE IF NOT EXISTS compras_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  compra_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade DECIMAL(10,3) NOT NULL CHECK (quantidade > 0),
  valor_unitario DECIMAL(10,2) NOT NULL CHECK (valor_unitario > 0),
  valor_total DECIMAL(10,2) NOT NULL,
  recebido DECIMAL(10,3) DEFAULT 0 COMMENT 'Quantidade recebida',
  CONSTRAINT fk_ci_compra FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE,
  CONSTRAINT fk_ci_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE RESTRICT,
  INDEX idx_compra (compra_id),
  INDEX idx_produto (produto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Itens de compra';

-- Adicionar foreign key de compra_id em contas_pagar se a tabela já existir
SET @exist := (SELECT COUNT(*) FROM information_schema.table_constraints 
               WHERE constraint_schema = DATABASE() 
               AND table_name = 'contas_pagar' 
               AND constraint_name = 'fk_cp_compra');
SET @sqlstmt := IF(@exist = 0, 
  'ALTER TABLE contas_pagar ADD CONSTRAINT fk_cp_compra FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ========== STEP: 014_oficina_completo ==========
-- Migração: Sistema de Oficina - OS e Orçamentos de Serviço
-- Executa com: mysql -u user -p database < 014_oficina_completo.sql

-- 1) Tabela de Orçamentos de Serviço
CREATE TABLE IF NOT EXISTS orcamentos_servico (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero VARCHAR(50) UNIQUE NOT NULL COMMENT 'Número sequencial do orçamento',
  cliente_id INT NOT NULL,
  veiculo_id INT NOT NULL,
  data DATE NOT NULL,
  status ENUM('ABERTA', 'AGUARDANDO_APROVACAO', 'APROVADO', 'REJEITADO') DEFAULT 'ABERTA',
  valor_total DECIMAL(10,2) DEFAULT 0,
  observacoes TEXT NULL,
  usuario_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_oserv_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_oserv_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos(id) ON DELETE RESTRICT,
  CONSTRAINT fk_oserv_usuario FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_cliente (cliente_id),
  INDEX idx_veiculo (veiculo_id),
  INDEX idx_status (status),
  INDEX idx_data (data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Orçamentos de serviço da oficina';

-- 2) Tabela de Serviços do Orçamento
CREATE TABLE IF NOT EXISTS orcamentos_servico_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orcamento_servico_id INT NOT NULL,
  servico_id INT NULL COMMENT 'ID do serviço (se cadastrado)',
  descricao VARCHAR(255) NOT NULL,
  quantidade DECIMAL(10,3) NOT NULL DEFAULT 1,
  valor_unitario DECIMAL(10,2) NOT NULL,
  valor_total DECIMAL(10,2) NOT NULL,
  tipo ENUM('SERVICO', 'PECA') NOT NULL DEFAULT 'SERVICO',
  produto_id INT NULL COMMENT 'Se tipo=PECA, referência ao produto',
  CONSTRAINT fk_osi_orcamento FOREIGN KEY (orcamento_servico_id) REFERENCES orcamentos_servico(id) ON DELETE CASCADE,
  CONSTRAINT fk_osi_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL,
  INDEX idx_orcamento (orcamento_servico_id),
  INDEX idx_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Itens de orçamento de serviço';

-- 3) Tabela de Ordens de Serviço (OS)
CREATE TABLE IF NOT EXISTS oficina_os (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero VARCHAR(50) UNIQUE NOT NULL COMMENT 'Número sequencial da OS',
  cliente_id INT NOT NULL,
  veiculo_id INT NOT NULL,
  data_abertura DATE NOT NULL,
  data_previsao DATE NULL,
  data_fechamento DATE NULL,
  status ENUM('ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_PECAS', 'FINALIZADA', 'CANCELADA') DEFAULT 'ABERTA',
  km_entrada INT NULL,
  km_saida INT NULL,
  valor_servicos DECIMAL(10,2) DEFAULT 0,
  valor_pecas DECIMAL(10,2) DEFAULT 0,
  valor_total DECIMAL(10,2) DEFAULT 0 COMMENT 'Calculado: valor_servicos + valor_pecas',
  observacoes TEXT NULL,
  usuario_id INT NOT NULL COMMENT 'Mecânico responsável',
  orcamento_servico_id INT NULL COMMENT 'Se originou de um orçamento',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_os_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_os_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos(id) ON DELETE RESTRICT,
  CONSTRAINT fk_os_usuario FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_os_orcamento FOREIGN KEY (orcamento_servico_id) REFERENCES orcamentos_servico(id) ON DELETE SET NULL,
  INDEX idx_cliente (cliente_id),
  INDEX idx_veiculo (veiculo_id),
  INDEX idx_status (status),
  INDEX idx_data_abertura (data_abertura),
  INDEX idx_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Ordens de serviço';

-- 4) Tabela de Checklists da OS
CREATE TABLE IF NOT EXISTS os_checklists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  os_id INT NOT NULL,
  item_nome VARCHAR(255) NOT NULL,
  descricao TEXT NULL,
  concluido BOOLEAN DEFAULT FALSE,
  data_conclusao TIMESTAMP NULL,
  responsavel_id INT NULL COMMENT 'Usuário que concluiu',
  observacoes TEXT NULL,
  ordem INT DEFAULT 0 COMMENT 'Ordem de exibição',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ocl_os FOREIGN KEY (os_id) REFERENCES oficina_os(id) ON DELETE CASCADE,
  CONSTRAINT fk_ocl_responsavel FOREIGN KEY (responsavel_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_os (os_id),
  INDEX idx_concluido (concluido),
  INDEX idx_ordem (ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Checklist de itens da OS';

-- ========== STEP: 015_cotacoes_compra_fornecedores ==========
-- Migração: Cotações de Compra e Fornecedores
-- Executa com: mysql -u user -p database < 015_cotacoes_compra_fornecedores.sql

-- 1) Tabela de Cotações de Compra (histórico; "última" = mais recente por codigo_produto)
CREATE TABLE IF NOT EXISTS cotacoes_compra (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo_produto VARCHAR(255) NOT NULL COMMENT 'Código do produto',
  valor_custo DECIMAL(10,2) NOT NULL,
  local VARCHAR(255) NOT NULL COMMENT 'Onde foi cotado/comprado (fornecedor ou texto livre)',
  data DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_codigo_produto (codigo_produto),
  INDEX idx_data (data),
  INDEX idx_codigo_data (codigo_produto, data DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Histórico de cotações de compra por código de produto';

-- 2) Tabela de Fornecedores (Estoque > Fornecedores; autocomplete "Onde foi cotado")
CREATE TABLE IF NOT EXISTS fornecedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  row_hash CHAR(32) NOT NULL,
  nome_fantasia VARCHAR(255) NULL,
  razao_social VARCHAR(255) NULL,
  cnpj VARCHAR(20) NULL,
  endereco VARCHAR(500) NULL,
  telefone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  responsavel VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_row_hash (row_hash),
  INDEX idx_nome_fantasia (nome_fantasia),
  INDEX idx_razao_social (razao_social),
  INDEX idx_cnpj (cnpj)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Cadastro de fornecedores';

-- ========== STEP: 016_servicos ==========
-- Migração: Módulo Serviços (Administração > Serviços)
-- Executa com: mysql -u user -p database < 016_servicos.sql

-- 1) Tabela de Serviços (centro de custo / tipo de serviço)
CREATE TABLE IF NOT EXISTS servicos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  codigo VARCHAR(50) NULL,
  descricao TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nome (nome),
  INDEX idx_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Cadastro de serviços (ex: Troca de Óleo, Revisão)';

-- 2) Tabela de Itens do checklist do serviço
CREATE TABLE IF NOT EXISTS servico_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  servico_id INT NOT NULL,
  descricao VARCHAR(500) NOT NULL,
  ordem INT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_si_servico FOREIGN KEY (servico_id) REFERENCES servicos(id) ON DELETE CASCADE,
  INDEX idx_servico (servico_id),
  INDEX idx_ordem (ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Itens do checklist por serviço';

-- ========== STEP: 017_elevadores ==========
-- Migração: Módulo Elevadores (Administração > Elevadores / Oficina > Pátio)
-- Executa com: mysql -u user -p database < 017_elevadores.sql

-- 1) Tabela de Elevadores (vaga/canal no Pátio da Oficina)
CREATE TABLE IF NOT EXISTS elevadores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  empresa_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_elev_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  INDEX idx_empresa (empresa_id),
  INDEX idx_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Elevadores do pátio (por empresa)';

-- 2) Coluna elevador_id em orcamentos (para Pátio Kanban – orçamento associado ao elevador)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'orcamentos' AND column_name = 'elevador_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE orcamentos ADD COLUMN elevador_id INT NULL AFTER veiculo_id, ADD CONSTRAINT fk_orc_elevador FOREIGN KEY (elevador_id) REFERENCES elevadores(id) ON DELETE SET NULL, ADD INDEX idx_elevador (elevador_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ========== STEP: 018_orcamento_servicos_totais_historico ==========
-- Migração: Orçamento com itens de serviço, totais e histórico de valor
-- Executa com: mysql -u user -p database < 018_orcamento_servicos_totais_historico.sql

-- 1) Colunas em orcamentos para itens de serviço e totais
SET @col_servico = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'orcamentos' AND column_name = 'json_itens_servico');
SET @sql1 = IF(@col_servico = 0,
  'ALTER TABLE orcamentos ADD COLUMN json_itens_servico JSON NULL AFTER json_itens',
  'SELECT 1');
PREPARE stmt1 FROM @sql1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

SET @col_tp = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'orcamentos' AND column_name = 'total_pecas');
SET @sql2 = IF(@col_tp = 0, 'ALTER TABLE orcamentos ADD COLUMN total_pecas DECIMAL(10,2) NULL DEFAULT 0 AFTER total', 'SELECT 1');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @col_ts = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'orcamentos' AND column_name = 'total_servico');
SET @sql3 = IF(@col_ts = 0, 'ALTER TABLE orcamentos ADD COLUMN total_servico DECIMAL(10,2) NULL DEFAULT 0 AFTER total_pecas', 'SELECT 1');
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- 2) Tabela de histórico de valor dos itens de serviço (usado em orçamentos)
CREATE TABLE IF NOT EXISTS servico_item_valor_historico (
  id INT AUTO_INCREMENT PRIMARY KEY,
  servico_item_id INT NOT NULL COMMENT 'FK item do checklist (servico_itens.id)',
  orcamento_id INT NULL COMMENT 'Orçamento em que o valor foi usado',
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sivh_servico_item FOREIGN KEY (servico_item_id) REFERENCES servico_itens(id) ON DELETE CASCADE,
  CONSTRAINT fk_sivh_orcamento FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE SET NULL,
  INDEX idx_servico_item (servico_item_id),
  INDEX idx_orcamento (orcamento_id),
  INDEX idx_data (data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Histórico de valor dos itens de serviço em orçamentos';

-- ========== STEP: 019_servico_valor_historico ==========
-- Migração: Histórico de valor por SERVIÇO em orçamentos
-- Executa com: mysql -u user -p database < 019_servico_valor_historico.sql

CREATE TABLE IF NOT EXISTS servico_valor_historico (
  id INT AUTO_INCREMENT PRIMARY KEY,
  servico_id INT NOT NULL COMMENT 'FK serviço (servicos.id)',
  orcamento_id INT NULL COMMENT 'Orçamento em que o valor foi usado',
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_svh_servico FOREIGN KEY (servico_id) REFERENCES servicos(id) ON DELETE CASCADE,
  CONSTRAINT fk_svh_orcamento FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE SET NULL,
  INDEX idx_servico (servico_id),
  INDEX idx_orcamento (orcamento_id),
  INDEX idx_data (data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Histórico de valor dos SERVIÇOS em orçamentos';

-- ========== STEP: 020_stock_pending_nf ==========
-- Migração: Estoque - Aguardando NF (qty_pending_nf) e compatibilidade com saldos
-- Executa com: mysql -u user -p database < 020_stock_pending_nf.sql

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

-- ========== STEP: 021_stock_by_empresa ==========
-- Migração: Estoque por Empresa (loja = empresa)
-- Substitui location_id por empresa_id em stock_balances, stock_movements e reservations.
-- Requer ao menos uma empresa cadastrada. Executa com: mysql -u user -p database < 021_stock_by_empresa.sql

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

-- ========== STEP: 022_empresas_loja ==========
-- Migração: Campo loja (boolean) na tabela empresas
-- Indica quais empresas são usadas como loja (local de estoque). Front exibe badge "Loja" quando loja = 1.

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = 'empresas' AND column_name = 'loja');
SET @sql = IF(@col = 0, 'ALTER TABLE empresas ADD COLUMN loja TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''Indica se a empresa é loja (local de estoque)'' AFTER estado', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS empresas_loja_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 023_email_templates_extend ==========
-- Migração: expandir email_templates para novos tipos de template
-- Novos template_key: SUPPLIER_ORDER, CLIENT_QUOTE

-- Só altera se a tabela existir
SET @tbl := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE table_schema = DATABASE() AND table_name = 'email_templates'
);

SET @sql := IF(
  @tbl > 0,
  'ALTER TABLE email_templates MODIFY COLUMN template_key ENUM(''FIRST_ACCESS'',''RESET'',''SUPPLIER_ORDER'',''CLIENT_QUOTE'') NOT NULL',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS email_templates_extend_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 025_email_templates_global_fix ==========
-- Migração: correção email_templates globais (remover owner_master_user_id se ainda existir)

-- Verifica se tabela email_templates existe
SET @tbl := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE table_schema = DATABASE() AND table_name = 'email_templates'
);

-- Verifica se coluna owner_master_user_id existe
SET @hasOwner := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND column_name = 'owner_master_user_id'
);

-- Remover FK fk_email_tpl_owner, se existir
SET @fk := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_email_tpl_owner'
);
SET @sql_fk := IF(
  @tbl > 0 AND @fk IS NOT NULL,
  'ALTER TABLE email_templates DROP FOREIGN KEY fk_email_tpl_owner',
  'SELECT 1'
);
PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- Remover índice uniq_owner_key, se existir
SET @idx := (
  SELECT INDEX_NAME
  FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND INDEX_NAME = 'uniq_owner_key'
);
SET @sql_idx := IF(
  @tbl > 0 AND @idx IS NOT NULL,
  'ALTER TABLE email_templates DROP INDEX uniq_owner_key',
  'SELECT 1'
);
PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- Remover coluna owner_master_user_id, se existir
SET @sql_col := IF(
  @tbl > 0 AND @hasOwner > 0,
  'ALTER TABLE email_templates DROP COLUMN owner_master_user_id',
  'SELECT 1'
);
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- Garantir índice único global por template_key
SET @hasUniqKey := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND INDEX_NAME = 'uniq_template_key'
);
SET @sql_uk := IF(
  @tbl > 0 AND @hasUniqKey = 0,
  'ALTER TABLE email_templates ADD UNIQUE KEY uniq_template_key (template_key)',
  'SELECT 1'
);
PREPARE stmt_uk FROM @sql_uk;
EXECUTE stmt_uk;
DEALLOCATE PREPARE stmt_uk;

-- tabela marcadora
CREATE TABLE IF NOT EXISTS email_templates_global_fix_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 026_email_logs ==========
-- Migração: logs de envio de e-mails (orçamentos para clientes e pedidos para fornecedores)

-- Histórico de e-mails de orçamento para clientes
CREATE TABLE IF NOT EXISTS email_client_quote_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  orcamento_id INT NULL,
  cliente_id INT NULL,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  html_body MEDIUMTEXT NOT NULL,
  template_key ENUM('CLIENT_QUOTE') NOT NULL DEFAULT 'CLIENT_QUOTE',
  sent_by_user_id INT NULL,
  status ENUM('SUCCESS','ERROR') NOT NULL DEFAULT 'SUCCESS',
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_orcamento (orcamento_id),
  INDEX idx_cliente (cliente_id),
  INDEX idx_sent_by (sent_by_user_id),
  CONSTRAINT fk_email_quote_orcamento FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE SET NULL,
  CONSTRAINT fk_email_quote_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
  CONSTRAINT fk_email_quote_user FOREIGN KEY (sent_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Histórico de e-mails de pedido para fornecedores
CREATE TABLE IF NOT EXISTS email_supplier_order_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NULL,
  fornecedor_id INT NULL,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  html_body MEDIUMTEXT NOT NULL,
  template_key ENUM('SUPPLIER_ORDER') NOT NULL DEFAULT 'SUPPLIER_ORDER',
  sent_by_user_id INT NULL,
  status ENUM('SUCCESS','ERROR') NOT NULL DEFAULT 'SUCCESS',
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pedido (pedido_id),
  INDEX idx_fornecedor (fornecedor_id),
  INDEX idx_sent_by (sent_by_user_id),
  CONSTRAINT fk_email_sup_pedido FOREIGN KEY (pedido_id) REFERENCES compras(id) ON DELETE SET NULL,
  CONSTRAINT fk_email_sup_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE SET NULL,
  CONSTRAINT fk_email_sup_user FOREIGN KEY (sent_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 027_email_templates_global_fix2 ==========
-- Migração 027: correção extra para tornar email_templates global
-- Objetivo: remover owner_master_user_id (se ainda existir) e garantir UNIQUE(template_key)

-- Verifica se tabela email_templates existe
SET @tbl := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE table_schema = DATABASE() AND table_name = 'email_templates'
);

-- Verifica se coluna owner_master_user_id existe
SET @hasOwner := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND column_name = 'owner_master_user_id'
);

-- Remover FK fk_email_tpl_owner, se existir
SET @fk := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_email_tpl_owner'
);
SET @sql_fk := IF(
  @tbl > 0 AND @fk IS NOT NULL,
  'ALTER TABLE email_templates DROP FOREIGN KEY fk_email_tpl_owner',
  'SELECT 1'
);
PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- Remover índice uniq_owner_key, se existir
SET @idx := (
  SELECT INDEX_NAME
  FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND INDEX_NAME = 'uniq_owner_key'
);
SET @sql_idx := IF(
  @tbl > 0 AND @idx IS NOT NULL,
  'ALTER TABLE email_templates DROP INDEX uniq_owner_key',
  'SELECT 1'
);
PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- Remover coluna owner_master_user_id, se existir
SET @sql_col := IF(
  @tbl > 0 AND @hasOwner > 0,
  'ALTER TABLE email_templates DROP COLUMN owner_master_user_id',
  'SELECT 1'
);
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- Garantir índice único global por template_key
SET @hasUniqKey := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND INDEX_NAME = 'uniq_template_key'
);
SET @sql_uk := IF(
  @tbl > 0 AND @hasUniqKey = 0,
  'ALTER TABLE email_templates ADD UNIQUE KEY uniq_template_key (template_key)',
  'SELECT 1'
);
PREPARE stmt_uk FROM @sql_uk;
EXECUTE stmt_uk;
DEALLOCATE PREPARE stmt_uk;

-- tabela marcadora
CREATE TABLE IF NOT EXISTS email_templates_global_fix2_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 028_email_templates_global_fix3 ==========
-- Migração 028: tornar email_templates totalmente global (sem owner_master_user_id)
-- Esta versão evita IF ... THEN (que não roda fora de procedures) usando SQL dinâmico.

-- Verifica se tabela email_templates existe
SET @tbl := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE table_schema = DATABASE() AND table_name = 'email_templates'
);

-- Remover FK fk_email_tpl_owner, se existir
SET @fk_count := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_email_tpl_owner'
);
SET @sql_fk := IF(
  @tbl > 0 AND @fk_count > 0,
  'ALTER TABLE email_templates DROP FOREIGN KEY fk_email_tpl_owner',
  'SELECT 1'
);
PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- Remover índice uniq_owner_key, se existir
SET @idx_count := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND INDEX_NAME = 'uniq_owner_key'
);
SET @sql_idx := IF(
  @tbl > 0 AND @idx_count > 0,
  'ALTER TABLE email_templates DROP INDEX uniq_owner_key',
  'SELECT 1'
);
PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- Remover coluna owner_master_user_id, se existir
SET @col_count := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND column_name = 'owner_master_user_id'
);
SET @sql_col := IF(
  @tbl > 0 AND @col_count > 0,
  'ALTER TABLE email_templates DROP COLUMN owner_master_user_id',
  'SELECT 1'
);
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- Garantir índice único global por template_key
SET @uniq_count := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND INDEX_NAME = 'uniq_template_key'
);
SET @sql_uk := IF(
  @tbl > 0 AND @uniq_count = 0,
  'ALTER TABLE email_templates ADD UNIQUE KEY uniq_template_key (template_key)',
  'SELECT 1'
);
PREPARE stmt_uk FROM @sql_uk;
EXECUTE stmt_uk;
DEALLOCATE PREPARE stmt_uk;

-- tabela marcadora
CREATE TABLE IF NOT EXISTS email_templates_global_fix3_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 029_empresas_logo ==========
-- Migração: Campo logo_base64 na tabela empresas
-- Armazena o logo da empresa em base64 para uso em telas e e-mails.

-- Adicionar coluna logo_base64 se ainda não existir
SET @col_logo := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE()
    AND table_name = 'empresas'
    AND column_name = 'logo_base64'
);

SET @sql_logo := IF(
  @col_logo = 0,
  'ALTER TABLE empresas ADD COLUMN logo_base64 LONGTEXT NULL COMMENT ''Logo da empresa em base64'' AFTER estado',
  'SELECT 1'
);

PREPARE stmt_logo FROM @sql_logo;
EXECUTE stmt_logo;
DEALLOCATE PREPARE stmt_logo;

-- Tabela marcador para o MigrationService
CREATE TABLE IF NOT EXISTS empresas_logo_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 030_users_empresa ==========
-- Migração: vínculo de usuários com empresas (users.empresa_id)

-- Adicionar coluna empresa_id se ainda não existir
SET @col_emp := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'empresa_id'
);

SET @sql_emp := IF(
  @col_emp = 0,
  'ALTER TABLE users ADD COLUMN empresa_id INT NULL AFTER role_id',
  'SELECT 1'
);

PREPARE stmt_emp FROM @sql_emp;
EXECUTE stmt_emp;
DEALLOCATE PREPARE stmt_emp;

-- Garantir índice em empresa_id
SET @idx_emp := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND index_name = 'idx_users_empresa_id'
);

SET @sql_idx_emp := IF(
  @idx_emp = 0,
  'ALTER TABLE users ADD INDEX idx_users_empresa_id (empresa_id)',
  'SELECT 1'
);

PREPARE stmt_idx_emp FROM @sql_idx_emp;
EXECUTE stmt_idx_emp;
DEALLOCATE PREPARE stmt_idx_emp;

-- Adicionar FK (se ainda não existir)
SET @fk_emp := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE constraint_schema = DATABASE()
    AND table_name = 'users'
    AND constraint_name = 'fk_users_empresa'
);

SET @sql_fk_emp := IF(
  @fk_emp = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL',
  'SELECT 1'
);

PREPARE stmt_fk_emp FROM @sql_fk_emp;
EXECUTE stmt_fk_emp;
DEALLOCATE PREPARE stmt_fk_emp;

-- Tabela marcador para o MigrationService
CREATE TABLE IF NOT EXISTS users_empresa_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 031_password_reset_tokens ==========
-- Garante que a tabela password_reset_tokens existe (usada por forgot-password e primeiro acesso).
-- O arquivo 001 não é executado pelo MigrationService; esta migration corrige isso.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  type ENUM('FIRST_ACCESS','RESET') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_type (user_id, type),
  UNIQUE KEY uniq_token_hash (token_hash),
  CONSTRAINT fk_pwd_token_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Marcador para o MigrationService
CREATE TABLE IF NOT EXISTS password_reset_tokens_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 032_empresas_logo_url ==========
-- Migração: Substituir logo_base64 por logo_url na tabela empresas
-- Armazena apenas o link (URL) da imagem do logo para uso em telas e e-mails.

-- Adicionar coluna logo_url se ainda não existir
SET @col_url := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE()
    AND table_name = 'empresas'
    AND column_name = 'logo_url'
);

SET @sql_url := IF(
  @col_url = 0,
  'ALTER TABLE empresas ADD COLUMN logo_url VARCHAR(512) NULL COMMENT ''URL do logo da empresa'' AFTER estado',
  'SELECT 1'
);

PREPARE stmt_url FROM @sql_url;
EXECUTE stmt_url;
DEALLOCATE PREPARE stmt_url;

-- Remover coluna logo_base64 se existir
SET @col_base64 := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE()
    AND table_name = 'empresas'
    AND column_name = 'logo_base64'
);

SET @sql_drop := IF(
  @col_base64 > 0,
  'ALTER TABLE empresas DROP COLUMN logo_base64',
  'SELECT 1'
);

PREPARE stmt_drop FROM @sql_drop;
EXECUTE stmt_drop;
DEALLOCATE PREPARE stmt_drop;

-- Tabela marcador para o MigrationService
CREATE TABLE IF NOT EXISTS empresas_logo_url_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 033_pedidos_compra ==========
-- Migração: Tabela pedidos_compra (pedidos de cotação enviados a fornecedores)

CREATE TABLE IF NOT EXISTS pedidos_compra (
  id INT AUTO_INCREMENT PRIMARY KEY,
  row_hash CHAR(32) NOT NULL,
  numero_sequencial INT NOT NULL,
  data DATE NOT NULL,
  status ENUM('Pendente', 'Enviado', 'Cotado', 'Recebido', 'Cancelado') NOT NULL DEFAULT 'Pendente',
  json_itens JSON NULL COMMENT 'Array de itens: produto_id, codigo_produto, produto, quantidade, unidade, preco_unitario, preco_custo, total',
  observacoes TEXT NULL,
  usuario_id INT NOT NULL,
  empresa_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_numero_sequencial (numero_sequencial),
  INDEX idx_data (data),
  INDEX idx_status (status),
  INDEX idx_usuario (usuario_id),
  INDEX idx_empresa (empresa_id),
  CONSTRAINT fk_pc_usuario FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pc_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Pedidos de compra para cotação com fornecedores';

-- Adicionar coluna pedido_compra_id em email_supplier_order_logs para referenciar pedidos_compra
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'email_supplier_order_logs' AND column_name = 'pedido_compra_id'
);
SET @sql_add := IF(@col_exists = 0,
  'ALTER TABLE email_supplier_order_logs ADD COLUMN pedido_compra_id INT NULL AFTER pedido_id, ADD INDEX idx_pedido_compra (pedido_compra_id), ADD CONSTRAINT fk_email_sup_pedido_compra FOREIGN KEY (pedido_compra_id) REFERENCES pedidos_compra(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

CREATE TABLE IF NOT EXISTS pedidos_compra_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 034_pedidos_compra_empresa_obrigatorio ==========
-- Migração: empresa_id obrigatório em pedidos_compra

-- Atualizar linhas com empresa_id NULL para a primeira empresa (se houver)
UPDATE pedidos_compra pc
SET pc.empresa_id = (SELECT e.id FROM empresas e LIMIT 1)
WHERE pc.empresa_id IS NULL
  AND EXISTS (SELECT 1 FROM empresas LIMIT 1);

-- Tornar empresa_id NOT NULL
ALTER TABLE pedidos_compra MODIFY empresa_id INT NOT NULL;

-- Marcar migration como aplicada
CREATE TABLE IF NOT EXISTS pedidos_compra_empresa_obrigatorio_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 035_orcamentos_tags ==========
-- Migração: Coluna tags (JSON) em orcamentos para tags de venda (venda_realizada, venda_nao_realizada)

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'orcamentos' AND column_name = 'tags'
);

SET @sql_add := IF(@col_exists = 0,
  'ALTER TABLE orcamentos ADD COLUMN tags JSON NULL COMMENT ''Array de tags: venda_realizada, venda_nao_realizada'' AFTER status',
  'SELECT 1');

PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

CREATE TABLE IF NOT EXISTS orcamentos_tags_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 036_auth_sessions ==========
-- Migração: Sessões server-side para refresh token rotativo

CREATE TABLE IF NOT EXISTS auth_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  refresh_token_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  user_agent VARCHAR(512) NULL,
  ip VARCHAR(45) NULL,
  INDEX idx_user (user_id),
  INDEX idx_expires (expires_at),
  INDEX idx_revoked (revoked_at),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Sessões de autenticação com refresh token';

-- Tokens supersedidos (para detecção de replay)
CREATE TABLE IF NOT EXISTS auth_sessions_superseded (
  token_hash VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  superseded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS auth_sessions_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 037_role_dev ==========
-- Migração: Role DEV e usuário id 2
-- Executa com: mysql -u user -p database < 037_role_dev.sql

-- 1) Inserir role DEV (se não existir)
INSERT INTO roles (name, description)
VALUES ('DEV', 'Desenvolvedor - Acesso total para configuração do sistema')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 2) Atribuir todas as permissões à role DEV
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'DEV';

-- 3) Atualizar usuário id 2 para role DEV
UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'DEV' LIMIT 1)
WHERE id = 2;

-- ========== STEP: 038_modules_system ==========
-- Migração: Sistema de Módulos (modules) e vínculo permissions -> modules
-- Executa com: mysql -u user -p database < 038_modules_system.sql

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

-- ========== STEP: 039_dev_only_access ==========
-- Migração: DEV como única role com permissões, usuário 2 -> DEV
-- Executa com: mysql -u user -p database < 039_dev_only_access.sql

-- 1. Criar role DEV (se não existir)
INSERT INTO roles (name, description)
VALUES ('DEV', 'Desenvolvedor - Acesso total. Única role que pode editar MASTER e configurar o sistema.')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 2. Remover TODAS as permissões de TODAS as roles
DELETE FROM role_permissions;

-- 3. Atribuir TODAS as permissões apenas à role DEV
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'DEV' LIMIT 1), id FROM permissions;

-- 4. Alterar usuário id 2 para role DEV
UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'DEV' LIMIT 1)
WHERE id = 2;

-- ========== STEP: 040_menu_items ==========
-- Migração: Tabela menu_items para menu configurável
-- Executa com: mysql -u user -p database < 040_menu_items.sql

CREATE TABLE IF NOT EXISTS menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  parent_id INT NULL,
  module_key VARCHAR(50) NULL,
  label VARCHAR(100) NOT NULL,
  path VARCHAR(255) NULL,
  icon VARCHAR(50) NULL,
  `order` INT DEFAULT 0,
  permission VARCHAR(100) NULL,
  permission_create VARCHAR(100) NULL,
  permission_update VARCHAR(100) NULL,
  permission_update_partial VARCHAR(100) NULL,
  permission_delete VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_parent FOREIGN KEY (parent_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  INDEX idx_parent (parent_id),
  INDEX idx_order (parent_id, `order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 041_remove_users_role_column ==========
-- Migração: Remover coluna role da tabela users
-- O controle de acesso passa a ser exclusivamente via role_id (FK -> roles)
-- Executa com: mysql -u user -p database < 041_remove_users_role_column.sql

-- Remover coluna role (string/ENUM legada)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'role');
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE users DROP COLUMN role',
  'SELECT "Coluna role já foi removida" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ========== STEP: 042_modules_permissions_role_id ==========
-- Migração: Módulos, Permissões e Controle por role_id
-- Zerar permissões de todos exceto usuário id 2 (igor sotolani)
-- Executa com: mysql -u user -p database < 042_modules_permissions_role_id.sql

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

-- ========== STEP: 043_dev_only_modules_menu ==========
-- Migração: Apenas DEV com acesso, popular modules e module_id
-- Todos os usuários exceto DEV perdem permissões
-- Executa com: mysql -u user -p database < 043_dev_only_modules_menu.sql

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

-- ========== STEP: 044_menu_seed ==========
-- Migração: Seed do menu (baseado no menuConfig do frontend)
-- Executa com: mysql -u user -p database < 044_menu_seed.sql

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

-- ========== STEP: 045_modules_permissions_menu_completo ==========
-- Migração: Módulos, Permissões, Menu e DEV-only (consolidado)
-- Baseado no prompt de arquitetura RBAC
-- Executa com: mysql -u user -p database < 045_modules_permissions_menu_completo.sql
-- Ordem: executar após 043 e 044 (ou em ambiente limpo)

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

-- ========== STEP: 046_modules_menu_users_reset ==========
-- Migração: Módulos, Menu e Reset de Usuários
-- 1. Garante todos os módulos cadastrados
-- 2. Preenche module_id em permissions
-- 3. Seed completo do menu
-- 4. Remove todos os usuários exceto id 2 (igor sotolani)
-- Executa com: mysql -u user -p campauto < 046_modules_menu_users_reset.sql

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

-- Seed módulos (conforme frontend)
INSERT INTO modules (`key`, label, description, icon, `order`) VALUES
  ('dashboard', 'Mapa do Sistema', 'Dashboard principal', 'LayoutDashboard', 0),
  ('vendas', 'Vendas', 'Vendas, orçamentos e pedidos', 'ShoppingCart', 1),
  ('clientes', 'Clientes', 'Clientes físicos, jurídicos e veículos', 'UserCircle', 2),
  ('oficina', 'Oficina', 'Ordens de serviço e pátio', 'Wrench', 3),
  ('estoque', 'Estoque', 'Produtos, saldos e movimentações', 'Package', 4),
  ('financeiro', 'Financeiro', 'Contas a pagar/receber, caixa, NF', 'DollarSign', 5),
  ('contabil', 'Fiscal/Contábil', 'Exportações e DRE', 'FileText', 6),
  ('relatorios', 'Relatórios', 'Relatórios de vendas, oficina, estoque', 'BarChart3', 7),
  ('admin', 'Administração', 'Empresas, usuários, roles, configurações', 'Settings', 8),
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

-- Vincular por key (fallback quando module string ausente)
UPDATE permissions p INNER JOIN modules m ON m.`key` = 'admin' SET p.module_id = m.id WHERE p.`key` LIKE 'admin.%';
UPDATE permissions p INNER JOIN modules m ON m.`key` = 'contabil' SET p.module_id = m.id WHERE p.`key` LIKE 'accounting.%';
UPDATE permissions p INNER JOIN modules m ON m.`key` = 'dashboard' SET p.module_id = m.id WHERE p.`key` = 'dashboard.view';
UPDATE permissions p INNER JOIN modules m ON m.`key` = 'estoque' SET p.module_id = m.id WHERE p.`key` LIKE 'stock.%';
UPDATE permissions p INNER JOIN modules m ON m.`key` = 'financeiro' SET p.module_id = m.id WHERE p.`key` LIKE 'finance.%';
UPDATE permissions p INNER JOIN modules m ON m.`key` = 'oficina' SET p.module_id = m.id WHERE p.`key` LIKE 'service_orders.%' OR p.`key` LIKE 'checklists.%';
UPDATE permissions p INNER JOIN modules m ON m.`key` = 'relatorios' SET p.module_id = m.id WHERE p.`key` LIKE 'reports.%';
UPDATE permissions p INNER JOIN modules m ON m.`key` = 'rh' SET p.module_id = m.id WHERE p.`key` LIKE 'hr.%';
UPDATE permissions p INNER JOIN modules m ON m.`key` = 'vendas' SET p.module_id = m.id WHERE p.`key` LIKE 'sales.%' OR p.`key` IN ('commissions.read', 'reports.my_sales.read');

-- Atualizar module string para consistência
UPDATE permissions SET module = 'admin' WHERE `key` LIKE 'admin.%';
UPDATE permissions SET module = 'contabil' WHERE `key` LIKE 'accounting.%';
UPDATE permissions SET module = 'dashboard' WHERE `key` = 'dashboard.view';
UPDATE permissions SET module = 'estoque' WHERE `key` LIKE 'stock.%';
UPDATE permissions SET module = 'financeiro' WHERE `key` LIKE 'finance.%';
UPDATE permissions SET module = 'oficina' WHERE `key` LIKE 'service_orders.%' OR `key` LIKE 'checklists.%';
UPDATE permissions SET module = 'relatorios' WHERE `key` LIKE 'reports.%';
UPDATE permissions SET module = 'rh' WHERE `key` LIKE 'hr.%';
UPDATE permissions SET module = 'vendas' WHERE `key` LIKE 'sales.%' OR `key` IN ('commissions.read', 'reports.my_sales.read');

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

-- ========== 4. REMOVER USUÁRIOS (exceto id 2, ou user 1 se 2 não existir) ==========
-- Em fresh install: user 1 existe. Em dev: user 2 existe. Usar o que existir.
SET @keep_user = COALESCE((SELECT id FROM users WHERE id = 2 LIMIT 1), (SELECT id FROM users ORDER BY id LIMIT 1));

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

-- Limpar tabelas que referenciam usuários (evitar órfãos após DELETE)
DELETE FROM auth_sessions WHERE user_id != @keep_user;
DELETE FROM password_reset_tokens WHERE user_id != @keep_user;
DELETE FROM notifications WHERE user_id != @keep_user;
DELETE FROM notification_sent_log WHERE user_id != @keep_user;
DELETE FROM google_mail_integrations WHERE owner_master_user_id != @keep_user;

-- Deletar usuários exceto id 2
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM users WHERE id != @keep_user;
SET FOREIGN_KEY_CHECKS = 1;

-- ========== 5. ROLES E PERMISSÕES ==========
-- DEV: bypass total no código. MASTER: acesso via role_permissions.
INSERT INTO roles (name, description)
VALUES ('DEV', 'Desenvolvedor - Acesso total. Bypass em todas as verificações.')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- Garantir MASTER existe
INSERT INTO roles (name, description)
VALUES ('MASTER', 'Acesso total ao sistema. Pode cadastrar usuários e gerenciar roles.')
ON DUPLICATE KEY UPDATE description = VALUES(description);

DELETE FROM role_permissions;
-- DEV: todas as permissões
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'DEV' LIMIT 1), id FROM permissions;
-- MASTER: todas as permissões (cadastrar usuários, gerenciar roles, etc.)
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'MASTER' LIMIT 1), id FROM permissions;

-- Usuário mantido = MASTER (único usuário inicial, pode cadastrar os demais)
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'MASTER' LIMIT 1) WHERE id = @keep_user;

-- ========== STEP: 047_role_id_only ==========
-- Migração: Apenas role_id - remover coluna role e usar só permissões
-- Autorização: role_id -> role_permissions -> permissions
-- Executa com: mysql -u user -p campauto < 047_role_id_only.sql

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

-- ========== STEP: 048_audio_reprodutor ==========
-- Migração: Módulo Reprodutor de Áudio (acesso restrito a user_id 2 e 14)
-- Tabelas para armazenar arquivos WAV e histórico de reprodução

-- ========== 1. Tabela audio_reprodutor_files ==========
CREATE TABLE IF NOT EXISTS audio_reprodutor_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  size_bytes BIGINT NOT NULL,
  duration_seconds INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 2. Tabela audio_reprodutor_history ==========
CREATE TABLE IF NOT EXISTS audio_reprodutor_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  file_id INT NOT NULL,
  position_seconds INT NOT NULL DEFAULT 0,
  is_finished TINYINT(1) NOT NULL DEFAULT 0,
  annotations TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_file (user_id, file_id),
  CONSTRAINT fk_arh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_arh_file FOREIGN KEY (file_id) REFERENCES audio_reprodutor_files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 049_focus_nfe_integration ==========
-- Migração: Integração Focus NFe - tabelas para notas fiscais e logs

-- ========== 1. Tabela focus_nf (cache de notas fiscais) ==========
CREATE TABLE IF NOT EXISTS focus_nf (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('NFe','NFSe','NFe_Recebida') NOT NULL,
  chave_nfe VARCHAR(44) NULL COMMENT 'Chave de 44 dígitos (NFe)',
  referencia VARCHAR(100) NULL COMMENT 'Referência única do envio (ref)',
  empresa_id INT NULL,
  status VARCHAR(50) NULL COMMENT 'autorizado, cancelado, rejeitado, processando_autorizacao, etc',
  versao BIGINT NULL COMMENT 'Versão para busca incremental (nfes_recebidas)',
  cnpj_destinatario VARCHAR(14) NULL,
  numero VARCHAR(20) NULL,
  serie VARCHAR(10) NULL,
  data_emissao DATETIME NULL,
  valor_total DECIMAL(15,2) NULL,
  json_dados JSON NULL COMMENT 'Dados completos da nota',
  pedido_compra_id INT NULL COMMENT 'Vínculo com pedido de compra (entrada)',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_chave (chave_nfe),
  UNIQUE KEY uniq_ref (referencia),
  INDEX idx_tipo (tipo),
  INDEX idx_empresa (empresa_id),
  INDEX idx_status (status),
  INDEX idx_versao (versao),
  INDEX idx_cnpj_versao (cnpj_destinatario, versao),
  CONSTRAINT fk_fnf_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 2. Tabela focus_nf_itens (itens da nota para entrada de estoque) ==========
CREATE TABLE IF NOT EXISTS focus_nf_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  focus_nf_id INT NOT NULL,
  numero_item INT NOT NULL DEFAULT 1,
  codigo_produto VARCHAR(100) NULL,
  descricao VARCHAR(255) NULL,
  quantidade DECIMAL(15,4) NOT NULL DEFAULT 0,
  valor_unitario DECIMAL(15,4) NULL,
  produto_id INT NULL COMMENT 'Vinculado ao produto do sistema',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fnfi_nf FOREIGN KEY (focus_nf_id) REFERENCES focus_nf(id) ON DELETE CASCADE,
  CONSTRAINT fk_fnfi_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL,
  INDEX idx_focus_nf (focus_nf_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 3. Tabela focus_api_log (auditoria de erros 4xx/5xx) ==========
CREATE TABLE IF NOT EXISTS focus_api_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  metodo VARCHAR(10) NULL,
  url TEXT NULL,
  status_http INT NULL,
  request_body JSON NULL,
  response_body JSON NULL,
  referencia VARCHAR(100) NULL,
  chave_nfe VARCHAR(44) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status_http),
  INDEX idx_ref (referencia),
  INDEX idx_chave (chave_nfe),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 4. Tabela empresas_focus_config (config por empresa) ==========
CREATE TABLE IF NOT EXISTS empresas_focus_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  token_focus VARCHAR(255) NULL COMMENT 'Token da API Focus (Basic Auth)',
  certificado_base64 LONGTEXT NULL COMMENT 'Certificado digital em Base64',
  emite_nfe TINYINT(1) NOT NULL DEFAULT 0,
  emite_nfse TINYINT(1) NOT NULL DEFAULT 0,
  cnpj VARCHAR(14) NULL,
  ultima_versao_recebidas BIGINT NULL COMMENT 'Última versão conhecida para nfes_recebidas',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_empresa (empresa_id),
  CONSTRAINT fk_efc_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 050_focus_nf_caminho_xml ==========
-- Adiciona coluna para persistir caminho/URL do XML da nota autorizada
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'focus_nf' AND column_name = 'caminho_xml_nota_fiscal');
SET @sql = IF(@col = 0,
  'ALTER TABLE focus_nf ADD COLUMN caminho_xml_nota_fiscal VARCHAR(512) NULL COMMENT ''Caminho ou URL do XML da nota autorizada'' AFTER json_dados',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== STEP: 051_empresas_focus_config_ambiente ==========
-- Adiciona ambiente e webhook_secret em empresas_focus_config (config via sistema, não .env)
SET @col1 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'empresas_focus_config' AND column_name = 'ambiente');
SET @sql1 = IF(@col1 = 0,
  'ALTER TABLE empresas_focus_config ADD COLUMN ambiente VARCHAR(20) NULL DEFAULT ''homologacao'' COMMENT ''homologacao ou producao'' AFTER token_focus',
  'SELECT 1');
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @col2 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'empresas_focus_config' AND column_name = 'webhook_secret');
SET @sql2 = IF(@col2 = 0,
  'ALTER TABLE empresas_focus_config ADD COLUMN webhook_secret VARCHAR(255) NULL COMMENT ''Secret para validar webhooks Focus'' AFTER ambiente',
  'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- ========== STEP: 052_clientes_email_fiscal ==========
-- Adiciona email_fiscal em clientes (PF e PJ)
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'clientes' AND column_name = 'email_fiscal');
SET @sql = IF(@col = 0,
  'ALTER TABLE clientes ADD COLUMN email_fiscal VARCHAR(255) NULL COMMENT ''Email para recebimento de notas fiscais'' AFTER email',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== STEP: 053_email_template_nota_fiscal ==========
-- Adiciona template NOTA_FISCAL para envio de notas fiscais por e-mail
SET @tbl = (SELECT COUNT(*) FROM information_schema.TABLES WHERE table_schema = DATABASE() AND table_name = 'email_templates');
SET @sql = IF(@tbl > 0,
  'ALTER TABLE email_templates MODIFY COLUMN template_key ENUM(''FIRST_ACCESS'',''RESET'',''SUPPLIER_ORDER'',''CLIENT_QUOTE'',''NOTA_FISCAL'') NOT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT INTO email_templates (template_key, name, subject, html_body, is_active)
SELECT 'NOTA_FISCAL', 'Nota Fiscal - Padrão',
  'Nota Fiscal {{nota_numero}} - {{empresa_emitente_nome}}',
  '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;font-family:Arial,sans-serif;padding:20px">
  <div style="max-width:600px;margin:0 auto">
    <h2>Nota Fiscal {{nota_numero}}</h2>
    <p>Prezado(a) {{cliente_nome}},</p>
    <p>Segue em anexo a Nota Fiscal emitida por <strong>{{empresa_emitente_nome}}</strong> (CNPJ {{empresa_emitente_cnpj}}).</p>
    <p><strong>Valor total:</strong> {{valor_total}}</p>
    <p><strong>Chave de acesso:</strong> {{nota_chave}}</p>
    <p>Atenciosamente,<br>{{empresa_por_qual}}</p>
  </div></body></html>',
  1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE template_key = 'NOTA_FISCAL');

-- ========== STEP: 054_estoque_multi_empresas_orcamento_reserva ==========
-- Migração: Estoque Multi-Empresas + Orçamento + Reserva + Movimentação + Pré-Pedido
-- Cria stock_items (espelho produto×empresa), novas tabelas e alterações

-- 1) Criar tabela stock_items (espelho produto por empresa)
CREATE TABLE IF NOT EXISTS stock_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  empresa_id INT NOT NULL,
  qty_on_hand DECIMAL(12,4) DEFAULT 0,
  qty_reserved DECIMAL(12,4) DEFAULT 0,
  qty_in_budget DECIMAL(12,4) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_product_empresa (product_id, empresa_id),
  FOREIGN KEY (product_id) REFERENCES produtos(id) ON DELETE CASCADE,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  INDEX idx_product (product_id),
  INDEX idx_empresa (empresa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Migrar dados de stock_balances para stock_items (se stock_balances existir)
INSERT IGNORE INTO stock_items (product_id, empresa_id, qty_on_hand, qty_reserved, qty_in_budget)
SELECT sb.product_id, sb.empresa_id,
  COALESCE(sb.qty_on_hand, 0), COALESCE(sb.qty_reserved, 0), 0
FROM stock_balances sb
WHERE EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_schema = DATABASE() AND t.table_name = 'stock_balances');

-- 3) Espelho automático OBRIGATÓRIO: popular stock_items para TODOS produtos × empresas
INSERT IGNORE INTO stock_items (product_id, empresa_id, qty_on_hand, qty_reserved, qty_in_budget)
SELECT p.id, e.id, 0, 0, 0
FROM produtos p
CROSS JOIN empresas e
WHERE NOT EXISTS (SELECT 1 FROM stock_items si WHERE si.product_id = p.id AND si.empresa_id = e.id);

-- 5) Estender ENUM de stock_movements.type (adicionar novos tipos)
ALTER TABLE stock_movements MODIFY COLUMN type ENUM(
  'ENTRY','EXIT','ADJUSTMENT','RESERVE','RESERVE_RETURN','RESERVE_CONVERT',
  'entrada_manual','saida_venda','transferencia_saida','transferencia_entrada','reserva','devolucao_reserva'
) NOT NULL;

-- 6) Garantir empresa_id em orcamentos (já existe em setup)
SET @col_emp = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'orcamentos' AND column_name = 'empresa_id');
-- empresa_id já existe em orcamentos pelo setup.sql

-- 7) Transfer Orders
CREATE TABLE IF NOT EXISTS transfer_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  orcamento_id INT NULL,
  empresa_origem_id INT NOT NULL,
  empresa_destino_id INT NOT NULL,
  status ENUM('draft','requested','nf_issued','in_transit','received','canceled') DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE SET NULL,
  FOREIGN KEY (empresa_origem_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_destino_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  INDEX idx_orcamento (orcamento_id),
  INDEX idx_status (status),
  INDEX idx_empresa_origem (empresa_origem_id),
  INDEX idx_empresa_destino (empresa_destino_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transfer_order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  transfer_order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity DECIMAL(12,4) NOT NULL,
  FOREIGN KEY (transfer_order_id) REFERENCES transfer_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES produtos(id) ON DELETE RESTRICT,
  INDEX idx_transfer_order (transfer_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8) Pre-Orders
CREATE TABLE IF NOT EXISTS pre_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  orcamento_id INT NULL,
  status ENUM('created','pending_manager_review','approved_for_quote','quoted','supplier_selected','purchased','received','canceled') DEFAULT 'created',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE SET NULL,
  INDEX idx_orcamento (orcamento_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pre_order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pre_order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity DECIMAL(12,4) NOT NULL,
  FOREIGN KEY (pre_order_id) REFERENCES pre_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES produtos(id) ON DELETE RESTRICT,
  INDEX idx_pre_order (pre_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9) Alterações em reservations: orcamento_id, terms, document_url, status estendido
SET @col_orc = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'reservations' AND column_name = 'orcamento_id');
SET @sql_orc = IF(@col_orc = 0,
  'ALTER TABLE reservations ADD COLUMN orcamento_id INT NULL AFTER customer_id, ADD CONSTRAINT fk_res_orcamento FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE SET NULL, ADD INDEX idx_orcamento (orcamento_id)',
  'SELECT 1');
PREPARE stmt3 FROM @sql_orc; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

SET @col_terms = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'reservations' AND column_name = 'terms');
SET @sql_terms = IF(@col_terms = 0,
  'ALTER TABLE reservations ADD COLUMN terms JSON NULL COMMENT ''Retirada, devolucao, para_quem'' AFTER notes',
  'SELECT 1');
PREPARE stmt4 FROM @sql_terms; EXECUTE stmt4; DEALLOCATE PREPARE stmt4;

SET @col_doc = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'reservations' AND column_name = 'document_url');
SET @sql_doc = IF(@col_doc = 0,
  'ALTER TABLE reservations ADD COLUMN document_url VARCHAR(500) NULL COMMENT ''URL do documento assinado'' AFTER terms',
  'SELECT 1');
PREPARE stmt5 FROM @sql_doc; EXECUTE stmt5; DEALLOCATE PREPARE stmt5;

-- Estender status de reservations (draft, sent_to_customer, awaiting_signature, signed, delivered, closed, canceled)
ALTER TABLE reservations MODIFY COLUMN status ENUM(
  'ACTIVE','DUE_SOON','OVERDUE','RETURNED','CANCELED','CONVERTED',
  'draft','sent_to_customer','awaiting_signature','signed','delivered','closed','canceled'
) NOT NULL DEFAULT 'ACTIVE';

-- 10) Sales Log
CREATE TABLE IF NOT EXISTS sales_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tipo ENUM('intencao','venda','movimentacao','pre_pedido','reserva') NOT NULL,
  orcamento_id INT NULL,
  produto_id INT NULL,
  empresa_id INT NULL,
  vendedor_id INT NULL,
  cliente_id INT NULL,
  veiculo_id INT NULL,
  valor DECIMAL(12,2) NULL,
  quantidade DECIMAL(12,4) NULL,
  origem_item ENUM('estoque','movimentacao','compra') NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE SET NULL,
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL,
  INDEX idx_tipo (tipo),
  INDEX idx_orcamento (orcamento_id),
  INDEX idx_empresa (empresa_id),
  INDEX idx_vendedor (vendedor_id),
  INDEX idx_cliente (cliente_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== STEP: 055_orcamentos_observacoes_externas_nf ==========
-- Migration 055: Campos de observações no orçamento
-- observacoes_externas: corpo do e-mail enviado ao cliente
-- observacoes_nf: informações complementares da Nota Fiscal

ALTER TABLE orcamentos
  ADD COLUMN observacoes_externas TEXT NULL,
  ADD COLUMN observacoes_nf TEXT NULL;

-- Atualiza template CLIENT_QUOTE para incluir {{observacoes_externas_html}}
-- (insere antes do parágrafo "Este é um e-mail automático")
UPDATE email_templates
SET html_body = REPLACE(
  html_body,
  '</p>\n    <p style="margin:16px 0 0;color:#888;font-size:12px">',
  '</p>\n    {{observacoes_externas_html}}\n    <p style="margin:16px 0 0;color:#888;font-size:12px">'
)
WHERE template_key = 'CLIENT_QUOTE'
  AND html_body NOT LIKE '%{{observacoes_externas_html}}%'
  AND html_body LIKE '%Este é um e-mail automático%';

-- ========== STEP: 056_vinculos_module ==========
-- Migration 056: Módulo Vínculos - Produtos e Fábricas
-- Tabelas: produto_vinculos, fabricas, produto_fabrica
-- Permissões, role "Gestor de Vínculos", menu

-- ========== 1. Tabela produto_vinculos (vínculos entre produtos similares) ==========
CREATE TABLE IF NOT EXISTS produto_vinculos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto_id_origem INT NOT NULL,
  produto_id_vinculado INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_vinculo (produto_id_origem, produto_id_vinculado),
  CONSTRAINT fk_pv_origem FOREIGN KEY (produto_id_origem) REFERENCES produtos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pv_vinculado FOREIGN KEY (produto_id_vinculado) REFERENCES produtos(id) ON DELETE CASCADE,
  CONSTRAINT chk_pv_diferentes CHECK (produto_id_origem != produto_id_vinculado),
  INDEX idx_pv_origem (produto_id_origem),
  INDEX idx_pv_vinculado (produto_id_vinculado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 2. Tabela fabricas ==========
CREATE TABLE IF NOT EXISTS fabricas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  codigo VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_fabrica_nome (nome),
  INDEX idx_fabrica_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 3. Tabela produto_fabrica (N:N) ==========
CREATE TABLE IF NOT EXISTS produto_fabrica (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto_id INT NOT NULL,
  fabrica_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_produto_fabrica (produto_id, fabrica_id),
  CONSTRAINT fk_pf_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pf_fabrica FOREIGN KEY (fabrica_id) REFERENCES fabricas(id) ON DELETE CASCADE,
  INDEX idx_pf_produto (produto_id),
  INDEX idx_pf_fabrica (fabrica_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 4. Módulo vinculos ==========
INSERT IGNORE INTO modules (`key`, label, description, icon, `order`) VALUES
  ('vinculos', 'Vínculos', 'Vínculos entre produtos e fábricas', 'Link', 20);

-- ========== 5. Permissões vinculos ==========
INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'vinculos.read', 'Visualizar vínculos de produtos e fábricas', 'vinculos', id FROM modules WHERE `key` = 'vinculos' LIMIT 1;

INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'vinculos.create', 'Criar vínculos e cadastrar fábricas', 'vinculos', id FROM modules WHERE `key` = 'vinculos' LIMIT 1;

INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'vinculos.update', 'Editar vínculos e fábricas', 'vinculos', id FROM modules WHERE `key` = 'vinculos' LIMIT 1;

INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'vinculos.delete', 'Remover vínculos e fábricas', 'vinculos', id FROM modules WHERE `key` = 'vinculos' LIMIT 1;

-- ========== 6. Role Gestor de Vínculos ==========
INSERT INTO roles (name, description)
VALUES ('Gestor de Vínculos', 'Gestão de vínculos entre produtos e cadastro de fábricas')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ========== 7. Atribuir permissões vinculos à role Gestor de Vínculos ==========
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'Gestor de Vínculos' LIMIT 1), id FROM permissions WHERE `key` IN ('vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.delete');

-- ========== 8. Dar permissões vinculos às roles DEV e MASTER ==========
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'DEV' LIMIT 1), id FROM permissions WHERE `key` IN ('vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.delete');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'MASTER' LIMIT 1), id FROM permissions WHERE `key` IN ('vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.delete');

-- ========== 9. Menu Vínculos (também em 044; aqui como fallback) ==========
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT NULL, 'vinculos', 'Vínculos', NULL, 'Link', 20, 'vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.update', 'vinculos.delete'
FROM (SELECT 1) t
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE module_key = 'vinculos' AND parent_id IS NULL);

INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT m.id, 'vinculos', 'Vínculos de Produtos', '/dashboard/vinculos/produtos', 'Link', 0, 'vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.update', 'vinculos.delete'
FROM menu_items m WHERE m.module_key = 'vinculos' AND m.parent_id IS NULL
AND NOT EXISTS (SELECT 1 FROM menu_items c WHERE c.parent_id = m.id AND c.path = '/dashboard/vinculos/produtos');

INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT m.id, 'vinculos', 'Fábricas', '/dashboard/vinculos/fabricas', 'Building2', 1, 'vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.update', 'vinculos.delete'
FROM menu_items m WHERE m.module_key = 'vinculos' AND m.parent_id IS NULL
AND NOT EXISTS (SELECT 1 FROM menu_items c WHERE c.parent_id = m.id AND c.path = '/dashboard/vinculos/fabricas');

-- ========== STEP: 057_vinculos_grupos_model ==========
-- Migration 057: Modelo de grupos para vínculos de produtos
-- Substitui produto_vinculos (pares) por produto_vinculo_grupos + produto_vinculo_grupo_itens
-- Permite criar grupo com vários produtos de uma vez: { produto_ids: [1,2,3,4,5] }

-- ========== 1. Novas tabelas ==========
CREATE TABLE IF NOT EXISTS produto_vinculo_grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS produto_vinculo_grupo_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_id INT NOT NULL,
  produto_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_produto_grupo (produto_id),
  CONSTRAINT fk_pvgi_grupo FOREIGN KEY (grupo_id) REFERENCES produto_vinculo_grupos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pvgi_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
  INDEX idx_pvgi_grupo (grupo_id),
  INDEX idx_pvgi_produto (produto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 2. Remover tabela antiga (produto_vinculos) ==========
-- Dados existentes serão perdidos; recrie vínculos no novo modelo (grupos)
DROP TABLE IF EXISTS produto_vinculos;

