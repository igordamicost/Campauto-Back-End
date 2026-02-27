-- Migração: logs de envio de e-mails (orçamentos para clientes e pedidos para fornecedores)

USE campauto;

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

