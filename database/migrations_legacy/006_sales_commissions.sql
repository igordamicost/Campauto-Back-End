-- Migração: Sistema de Vendas e Comissões
-- Executa com: mysql -u user -p database < 006_sales_commissions.sql

USE campauto;

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
