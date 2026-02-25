-- Migração: Histórico de valor por SERVIÇO em orçamentos
-- Executa com: mysql -u user -p database < 019_servico_valor_historico.sql

USE campauto;

CREATE TABLE IF NOT EXISTS servico_valor_historico (
  id INT AUTO_INCREMENT PRIMARY KEY,
  servico_id INT NOT NULL COMMENT 'FK serviço (servicos.id)',
  orcamento_id INT NULL COMMENT 'Orçamento em que o valor foi usado',
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_svh_servico FOREIGN KEY (servico_id) REFERENCES servicos(id) ON DELETE CASCADE,
  CONSTRAINT fk_svh_orcamento FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE SET NULL,
  INDEX idx_servico (servico_id),
  INDEX idx_orcamento (orcamento_id),
  INDEX idx_data (data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Histórico de valor dos SERVIÇOS em orçamentos';

