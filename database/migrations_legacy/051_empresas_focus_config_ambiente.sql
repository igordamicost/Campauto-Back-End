-- Adiciona ambiente e webhook_secret em empresas_focus_config (config via sistema, não .env)
SET @col1 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'empresas_focus_config' AND column_name = 'ambiente');
SET @sql1 = IF(@col1 = 0,
  'ALTER TABLE empresas_focus_config ADD COLUMN ambiente VARCHAR(20) NULL DEFAULT ''homologacao'' COMMENT ''homologacao ou producao'' AFTER token_focus',
  'SELECT 1');
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @col2 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'empresas_focus_config' AND column_name = 'webhook_secret');
SET @sql2 = IF(@col2 = 0,
  'ALTER TABLE empresas_focus_config ADD COLUMN webhook_secret VARCHAR(255) NULL COMMENT ''Secret para validar webhooks Focus'' AFTER ambiente',
  'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
