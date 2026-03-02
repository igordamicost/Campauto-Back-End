-- Migração: Sistema de Compras
-- Executa com: mysql -u user -p database < 013_estoque_compras.sql

USE campauto;

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
