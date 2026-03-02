-- Migração: Sistema de Regras de Comissão
-- Executa com: mysql -u user -p database < 010_commission_rules.sql

USE campauto;

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
