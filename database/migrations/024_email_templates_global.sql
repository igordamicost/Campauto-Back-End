-- Migração: email_templates globais (sem owner_master_user_id)

USE campauto;

SET @tbl := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE table_schema = DATABASE() AND table_name = 'email_templates'
);

-- Só roda se a tabela existir
SET @hasOwner := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND column_name = 'owner_master_user_id'
);

IF @tbl > 0 AND @hasOwner > 0 THEN

  -- Remover FK se existir
  SET @fk := (
    SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
    WHERE table_schema = DATABASE() AND table_name = 'email_templates' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
      AND CONSTRAINT_NAME = 'fk_email_tpl_owner'
  );
  SET @sql_fk := IF(@fk IS NOT NULL, 'ALTER TABLE email_templates DROP FOREIGN KEY fk_email_tpl_owner', 'SELECT 1');
  PREPARE stmt_fk FROM @sql_fk;
  EXECUTE stmt_fk;
  DEALLOCATE PREPARE stmt_fk;

  -- Remover índice antigo se existir
  SET @idx := (
    SELECT INDEX_NAME FROM information_schema.STATISTICS
    WHERE table_schema = DATABASE() AND table_name = 'email_templates' AND INDEX_NAME = 'uniq_owner_key'
  );
  SET @sql_idx := IF(@idx IS NOT NULL, 'ALTER TABLE email_templates DROP INDEX uniq_owner_key', 'SELECT 1');
  PREPARE stmt_idx FROM @sql_idx;
  EXECUTE stmt_idx;
  DEALLOCATE PREPARE stmt_idx;

  -- Remover coluna owner_master_user_id
  ALTER TABLE email_templates DROP COLUMN owner_master_user_id;

  -- Garantir índice único global por template_key
  SET @hasUniqKey := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE table_schema = DATABASE() AND table_name = 'email_templates' AND INDEX_NAME = 'uniq_template_key'
  );
  SET @sql_uk := IF(@hasUniqKey = 0, 'ALTER TABLE email_templates ADD UNIQUE KEY uniq_template_key (template_key)', 'SELECT 1');
  PREPARE stmt_uk FROM @sql_uk;
  EXECUTE stmt_uk;
  DEALLOCATE PREPARE stmt_uk;

END IF;

CREATE TABLE IF NOT EXISTS email_templates_global_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

