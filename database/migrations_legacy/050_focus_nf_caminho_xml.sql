-- Adiciona coluna para persistir caminho/URL do XML da nota autorizada
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'focus_nf' AND column_name = 'caminho_xml_nota_fiscal');
SET @sql = IF(@col = 0,
  'ALTER TABLE focus_nf ADD COLUMN caminho_xml_nota_fiscal VARCHAR(512) NULL COMMENT ''Caminho ou URL do XML da nota autorizada'' AFTER json_dados',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
