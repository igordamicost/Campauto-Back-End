-- Migração: Sistema de Estoque
-- Executa com: mysql -u user -p database < 004_stock_system.sql

USE campauto;

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
