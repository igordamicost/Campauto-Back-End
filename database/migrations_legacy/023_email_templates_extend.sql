-- Migração: expandir email_templates para novos tipos de template
-- Novos template_key: SUPPLIER_ORDER, CLIENT_QUOTE

USE campauto;

-- Só altera se a tabela existir
SET @tbl := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE table_schema = DATABASE() AND table_name = 'email_templates'
);

SET @sql := IF(
  @tbl > 0,
  'ALTER TABLE email_templates MODIFY COLUMN template_key ENUM(''FIRST_ACCESS'',''RESET'',''SUPPLIER_ORDER'',''CLIENT_QUOTE'') NOT NULL',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS email_templates_extend_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

