-- Migração: Orçamento com itens de serviço, totais e histórico de valor
-- Executa com: mysql -u user -p database < 018_orcamento_servicos_totais_historico.sql

USE campauto;

-- 1) Colunas em orcamentos para itens de serviço e totais
SET @col_servico = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'orcamentos' AND column_name = 'json_itens_servico');
SET @sql1 = IF(@col_servico = 0,
  'ALTER TABLE orcamentos ADD COLUMN json_itens_servico JSON NULL AFTER json_itens',
  'SELECT 1');
PREPARE stmt1 FROM @sql1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

SET @col_tp = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'orcamentos' AND column_name = 'total_pecas');
SET @sql2 = IF(@col_tp = 0, 'ALTER TABLE orcamentos ADD COLUMN total_pecas DECIMAL(10,2) NULL DEFAULT 0 AFTER total', 'SELECT 1');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @col_ts = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'orcamentos' AND column_name = 'total_servico');
SET @sql3 = IF(@col_ts = 0, 'ALTER TABLE orcamentos ADD COLUMN total_servico DECIMAL(10,2) NULL DEFAULT 0 AFTER total_pecas', 'SELECT 1');
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- 2) Tabela de histórico de valor dos itens de serviço (usado em orçamentos)
CREATE TABLE IF NOT EXISTS servico_item_valor_historico (
  id INT AUTO_INCREMENT PRIMARY KEY,
  servico_item_id INT NOT NULL COMMENT 'FK item do checklist (servico_itens.id)',
  orcamento_id INT NULL COMMENT 'Orçamento em que o valor foi usado',
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sivh_servico_item FOREIGN KEY (servico_item_id) REFERENCES servico_itens(id) ON DELETE CASCADE,
  CONSTRAINT fk_sivh_orcamento FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE SET NULL,
  INDEX idx_servico_item (servico_item_id),
  INDEX idx_orcamento (orcamento_id),
  INDEX idx_data (data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Histórico de valor dos itens de serviço em orçamentos';
