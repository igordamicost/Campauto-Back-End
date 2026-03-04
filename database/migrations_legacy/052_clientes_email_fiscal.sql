-- Adiciona email_fiscal em clientes (PF e PJ)
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'clientes' AND column_name = 'email_fiscal');
SET @sql = IF(@col = 0,
  'ALTER TABLE clientes ADD COLUMN email_fiscal VARCHAR(255) NULL COMMENT ''Email para recebimento de notas fiscais'' AFTER email',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
