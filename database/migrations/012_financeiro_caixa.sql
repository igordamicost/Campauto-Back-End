-- Migração: Sistema Financeiro - Caixa e Bancos
-- Executa com: mysql -u user -p database < 012_financeiro_caixa.sql

USE campauto;

-- 1) Tabela de Contas de Caixa/Banco
CREATE TABLE IF NOT EXISTS caixa_contas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  tipo ENUM('CAIXA', 'BANCO') NOT NULL,
  banco VARCHAR(100) NULL COMMENT 'Nome do banco (se tipo=BANCO)',
  agencia VARCHAR(20) NULL COMMENT 'Agência (se tipo=BANCO)',
  conta VARCHAR(50) NULL COMMENT 'Número da conta (se tipo=BANCO)',
  saldo_inicial DECIMAL(10,2) DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tipo (tipo),
  INDEX idx_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Contas de caixa e banco';

-- 2) Tabela de Movimentações de Caixa
CREATE TABLE IF NOT EXISTS caixa_movimentacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conta_caixa_id INT NOT NULL,
  tipo ENUM('ENTRADA', 'SAIDA') NOT NULL,
  valor DECIMAL(10,2) NOT NULL CHECK (valor > 0),
  descricao VARCHAR(255) NOT NULL,
  data DATE NOT NULL,
  forma_pagamento VARCHAR(50) NULL,
  referencia_tipo VARCHAR(50) NULL COMMENT 'CONTA_RECEBER, CONTA_PAGAR, VENDA, etc',
  referencia_id INT NULL COMMENT 'ID da referência',
  usuario_id INT NOT NULL,
  observacoes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cm_conta FOREIGN KEY (conta_caixa_id) REFERENCES caixa_contas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cm_usuario FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_conta (conta_caixa_id),
  INDEX idx_data (data),
  INDEX idx_tipo (tipo),
  INDEX idx_referencia (referencia_tipo, referencia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Movimentações de caixa';
