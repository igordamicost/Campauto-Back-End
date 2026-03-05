-- Migração: Estoque Multi-Empresas + Orçamento + Reserva + Movimentação + Pré-Pedido
-- Adiciona qty_in_budget em stock_balances, novas tabelas e alterações

-- 1) Adicionar qty_in_budget em stock_balances (se não existir)
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'stock_balances' AND column_name = 'qty_in_budget');
SET @sql = IF(@col = 0,
  'ALTER TABLE stock_balances ADD COLUMN qty_in_budget DECIMAL(12,4) NOT NULL DEFAULT 0.000 COMMENT ''Quantidade em orçamentos não finalizados'' AFTER qty_reserved',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Atualizar qty_available para incluir qty_in_budget
SET @col_pnf = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'stock_balances' AND column_name = 'qty_pending_nf');
SET @sql_avail = IF(@col_pnf > 0,
  'ALTER TABLE stock_balances MODIFY COLUMN qty_available DECIMAL(12,4) GENERATED ALWAYS AS (qty_on_hand - qty_reserved - COALESCE(qty_in_budget, 0) - qty_pending_nf) STORED',
  'ALTER TABLE stock_balances MODIFY COLUMN qty_available DECIMAL(12,4) GENERATED ALWAYS AS (qty_on_hand - qty_reserved - COALESCE(qty_in_budget, 0)) STORED');
PREPARE stmt2 FROM @sql_avail; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- 3) Estender ENUM de stock_movements.type (adicionar novos tipos)
ALTER TABLE stock_movements MODIFY COLUMN type ENUM(
  'ENTRY','EXIT','ADJUSTMENT','RESERVE','RESERVE_RETURN','RESERVE_CONVERT',
  'entrada_manual','saida_venda','transferencia_saida','transferencia_entrada','reserva','devolucao_reserva'
) NOT NULL;

-- 4) Garantir empresa_id em orcamentos (já existe em setup, mas garantir FK)
SET @col_emp = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'orcamentos' AND column_name = 'empresa_id');
-- empresa_id já existe em orcamentos pelo setup.sql

-- 5) Transfer Orders
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

-- 6) Pre-Orders
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

-- 7) Alterações em reservations: orcamento_id, terms, document_url, status estendido
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

-- 8) Sales Log
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
