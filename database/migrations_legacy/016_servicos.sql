-- Migração: Módulo Serviços (Administração > Serviços)
-- Executa com: mysql -u user -p database < 016_servicos.sql

USE campauto;

-- 1) Tabela de Serviços (centro de custo / tipo de serviço)
CREATE TABLE IF NOT EXISTS servicos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  codigo VARCHAR(50) NULL,
  descricao TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nome (nome),
  INDEX idx_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Cadastro de serviços (ex: Troca de Óleo, Revisão)';

-- 2) Tabela de Itens do checklist do serviço
CREATE TABLE IF NOT EXISTS servico_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  servico_id INT NOT NULL,
  descricao VARCHAR(500) NOT NULL,
  ordem INT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_si_servico FOREIGN KEY (servico_id) REFERENCES servicos(id) ON DELETE CASCADE,
  INDEX idx_servico (servico_id),
  INDEX idx_ordem (ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Itens do checklist por serviço';
