-- Migração: Integração Focus NFe - tabelas para notas fiscais e logs

-- ========== 1. Tabela focus_nf (cache de notas fiscais) ==========
CREATE TABLE IF NOT EXISTS focus_nf (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('NFe','NFSe','NFe_Recebida') NOT NULL,
  chave_nfe VARCHAR(44) NULL COMMENT 'Chave de 44 dígitos (NFe)',
  referencia VARCHAR(100) NULL COMMENT 'Referência única do envio (ref)',
  empresa_id INT NULL,
  status VARCHAR(50) NULL COMMENT 'autorizado, cancelado, rejeitado, processando_autorizacao, etc',
  versao BIGINT NULL COMMENT 'Versão para busca incremental (nfes_recebidas)',
  cnpj_destinatario VARCHAR(14) NULL,
  numero VARCHAR(20) NULL,
  serie VARCHAR(10) NULL,
  data_emissao DATETIME NULL,
  valor_total DECIMAL(15,2) NULL,
  json_dados JSON NULL COMMENT 'Dados completos da nota',
  pedido_compra_id INT NULL COMMENT 'Vínculo com pedido de compra (entrada)',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_chave (chave_nfe),
  UNIQUE KEY uniq_ref (referencia),
  INDEX idx_tipo (tipo),
  INDEX idx_empresa (empresa_id),
  INDEX idx_status (status),
  INDEX idx_versao (versao),
  INDEX idx_cnpj_versao (cnpj_destinatario, versao),
  CONSTRAINT fk_fnf_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 2. Tabela focus_nf_itens (itens da nota para entrada de estoque) ==========
CREATE TABLE IF NOT EXISTS focus_nf_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  focus_nf_id INT NOT NULL,
  numero_item INT NOT NULL DEFAULT 1,
  codigo_produto VARCHAR(100) NULL,
  descricao VARCHAR(255) NULL,
  quantidade DECIMAL(15,4) NOT NULL DEFAULT 0,
  valor_unitario DECIMAL(15,4) NULL,
  produto_id INT NULL COMMENT 'Vinculado ao produto do sistema',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fnfi_nf FOREIGN KEY (focus_nf_id) REFERENCES focus_nf(id) ON DELETE CASCADE,
  CONSTRAINT fk_fnfi_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL,
  INDEX idx_focus_nf (focus_nf_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 3. Tabela focus_api_log (auditoria de erros 4xx/5xx) ==========
CREATE TABLE IF NOT EXISTS focus_api_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  metodo VARCHAR(10) NULL,
  url TEXT NULL,
  status_http INT NULL,
  request_body JSON NULL,
  response_body JSON NULL,
  referencia VARCHAR(100) NULL,
  chave_nfe VARCHAR(44) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status_http),
  INDEX idx_ref (referencia),
  INDEX idx_chave (chave_nfe),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 4. Tabela empresas_focus_config (config por empresa) ==========
CREATE TABLE IF NOT EXISTS empresas_focus_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  token_focus VARCHAR(255) NULL COMMENT 'Token da API Focus (Basic Auth)',
  certificado_base64 LONGTEXT NULL COMMENT 'Certificado digital em Base64',
  emite_nfe TINYINT(1) NOT NULL DEFAULT 0,
  emite_nfse TINYINT(1) NOT NULL DEFAULT 0,
  cnpj VARCHAR(14) NULL,
  ultima_versao_recebidas BIGINT NULL COMMENT 'Última versão conhecida para nfes_recebidas',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_empresa (empresa_id),
  CONSTRAINT fk_efc_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
