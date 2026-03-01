-- Migração: Tabela pedidos_compra (pedidos de cotação enviados a fornecedores)

USE campauto;

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
