-- Migração: Módulo Elevadores (Administração > Elevadores / Oficina > Pátio)
-- Executa com: mysql -u user -p database < 017_elevadores.sql

USE campauto;

-- 1) Tabela de Elevadores (vaga/canal no Pátio da Oficina)
CREATE TABLE IF NOT EXISTS elevadores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  empresa_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_elev_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT,
  INDEX idx_empresa (empresa_id),
  INDEX idx_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Elevadores do pátio (por empresa)';

-- 2) Coluna elevador_id em orcamentos (para Pátio Kanban – orçamento associado ao elevador)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'orcamentos' AND column_name = 'elevador_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE orcamentos ADD COLUMN elevador_id INT NULL AFTER veiculo_id, ADD CONSTRAINT fk_orc_elevador FOREIGN KEY (elevador_id) REFERENCES elevadores(id) ON DELETE SET NULL, ADD INDEX idx_elevador (elevador_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
