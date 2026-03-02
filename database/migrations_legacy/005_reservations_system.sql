-- Migração: Sistema de Reservas de Peças
-- Executa com: mysql -u user -p database < 005_reservations_system.sql

USE campauto;

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
