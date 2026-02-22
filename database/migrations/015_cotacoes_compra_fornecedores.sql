-- Migração: Cotações de Compra e Fornecedores
-- Executa com: mysql -u user -p database < 015_cotacoes_compra_fornecedores.sql

USE campauto;

-- 1) Tabela de Cotações de Compra (histórico; "última" = mais recente por codigo_produto)
CREATE TABLE IF NOT EXISTS cotacoes_compra (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo_produto VARCHAR(255) NOT NULL COMMENT 'Código do produto',
  valor_custo DECIMAL(10,2) NOT NULL,
  local VARCHAR(255) NOT NULL COMMENT 'Onde foi cotado/comprado (fornecedor ou texto livre)',
  data DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_codigo_produto (codigo_produto),
  INDEX idx_data (data),
  INDEX idx_codigo_data (codigo_produto, data DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Histórico de cotações de compra por código de produto';

-- 2) Tabela de Fornecedores (Estoque > Fornecedores; autocomplete "Onde foi cotado")
CREATE TABLE IF NOT EXISTS fornecedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  row_hash CHAR(32) NOT NULL,
  nome_fantasia VARCHAR(255) NULL,
  razao_social VARCHAR(255) NULL,
  cnpj VARCHAR(20) NULL,
  endereco VARCHAR(500) NULL,
  telefone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  responsavel VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_row_hash (row_hash),
  INDEX idx_nome_fantasia (nome_fantasia),
  INDEX idx_razao_social (razao_social),
  INDEX idx_cnpj (cnpj)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Cadastro de fornecedores';
