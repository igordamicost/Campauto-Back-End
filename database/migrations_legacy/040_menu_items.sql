-- Migração: Tabela menu_items para menu configurável
-- Executa com: mysql -u user -p database < 040_menu_items.sql

USE campauto;

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
