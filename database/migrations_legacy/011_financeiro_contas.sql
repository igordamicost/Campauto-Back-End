-- Migração: Sistema Financeiro - Contas a Receber e Contas a Pagar
-- Executa com: mysql -u user -p database < 011_financeiro_contas.sql

USE campauto;

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
