-- Migração: Sistema de Oficina - OS e Orçamentos de Serviço
-- Executa com: mysql -u user -p database < 014_oficina_completo.sql

USE campauto;

-- 1) Tabela de Orçamentos de Serviço
CREATE TABLE IF NOT EXISTS orcamentos_servico (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero VARCHAR(50) UNIQUE NOT NULL COMMENT 'Número sequencial do orçamento',
  cliente_id INT NOT NULL,
  veiculo_id INT NOT NULL,
  data DATE NOT NULL,
  status ENUM('ABERTA', 'AGUARDANDO_APROVACAO', 'APROVADO', 'REJEITADO') DEFAULT 'ABERTA',
  valor_total DECIMAL(10,2) DEFAULT 0,
  observacoes TEXT NULL,
  usuario_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_oserv_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_oserv_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos(id) ON DELETE RESTRICT,
  CONSTRAINT fk_oserv_usuario FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_cliente (cliente_id),
  INDEX idx_veiculo (veiculo_id),
  INDEX idx_status (status),
  INDEX idx_data (data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Orçamentos de serviço da oficina';

-- 2) Tabela de Serviços do Orçamento
CREATE TABLE IF NOT EXISTS orcamentos_servico_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orcamento_servico_id INT NOT NULL,
  servico_id INT NULL COMMENT 'ID do serviço (se cadastrado)',
  descricao VARCHAR(255) NOT NULL,
  quantidade DECIMAL(10,3) NOT NULL DEFAULT 1,
  valor_unitario DECIMAL(10,2) NOT NULL,
  valor_total DECIMAL(10,2) NOT NULL,
  tipo ENUM('SERVICO', 'PECA') NOT NULL DEFAULT 'SERVICO',
  produto_id INT NULL COMMENT 'Se tipo=PECA, referência ao produto',
  CONSTRAINT fk_osi_orcamento FOREIGN KEY (orcamento_servico_id) REFERENCES orcamentos_servico(id) ON DELETE CASCADE,
  CONSTRAINT fk_osi_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL,
  INDEX idx_orcamento (orcamento_servico_id),
  INDEX idx_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Itens de orçamento de serviço';

-- 3) Tabela de Ordens de Serviço (OS)
CREATE TABLE IF NOT EXISTS oficina_os (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero VARCHAR(50) UNIQUE NOT NULL COMMENT 'Número sequencial da OS',
  cliente_id INT NOT NULL,
  veiculo_id INT NOT NULL,
  data_abertura DATE NOT NULL,
  data_previsao DATE NULL,
  data_fechamento DATE NULL,
  status ENUM('ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_PECAS', 'FINALIZADA', 'CANCELADA') DEFAULT 'ABERTA',
  km_entrada INT NULL,
  km_saida INT NULL,
  valor_servicos DECIMAL(10,2) DEFAULT 0,
  valor_pecas DECIMAL(10,2) DEFAULT 0,
  valor_total DECIMAL(10,2) DEFAULT 0 COMMENT 'Calculado: valor_servicos + valor_pecas',
  observacoes TEXT NULL,
  usuario_id INT NOT NULL COMMENT 'Mecânico responsável',
  orcamento_servico_id INT NULL COMMENT 'Se originou de um orçamento',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_os_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_os_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos(id) ON DELETE RESTRICT,
  CONSTRAINT fk_os_usuario FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_os_orcamento FOREIGN KEY (orcamento_servico_id) REFERENCES orcamentos_servico(id) ON DELETE SET NULL,
  INDEX idx_cliente (cliente_id),
  INDEX idx_veiculo (veiculo_id),
  INDEX idx_status (status),
  INDEX idx_data_abertura (data_abertura),
  INDEX idx_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Ordens de serviço';

-- 4) Tabela de Checklists da OS
CREATE TABLE IF NOT EXISTS os_checklists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  os_id INT NOT NULL,
  item_nome VARCHAR(255) NOT NULL,
  descricao TEXT NULL,
  concluido BOOLEAN DEFAULT FALSE,
  data_conclusao TIMESTAMP NULL,
  responsavel_id INT NULL COMMENT 'Usuário que concluiu',
  observacoes TEXT NULL,
  ordem INT DEFAULT 0 COMMENT 'Ordem de exibição',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ocl_os FOREIGN KEY (os_id) REFERENCES oficina_os(id) ON DELETE CASCADE,
  CONSTRAINT fk_ocl_responsavel FOREIGN KEY (responsavel_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_os (os_id),
  INDEX idx_concluido (concluido),
  INDEX idx_ordem (ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Checklist de itens da OS';
