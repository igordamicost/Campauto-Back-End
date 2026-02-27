-- Migração: correção email_templates globais (remover owner_master_user_id se ainda existir)

USE campauto;

-- Verifica se tabela email_templates existe
SET @tbl := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE table_schema = DATABASE() AND table_name = 'email_templates'
);

-- Verifica se coluna owner_master_user_id existe
SET @hasOwner := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND column_name = 'owner_master_user_id'
);

-- Remover FK fk_email_tpl_owner, se existir
SET @fk := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_email_tpl_owner'
);
SET @sql_fk := IF(
  @tbl > 0 AND @fk IS NOT NULL,
  'ALTER TABLE email_templates DROP FOREIGN KEY fk_email_tpl_owner',
  'SELECT 1'
);
PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- Remover índice uniq_owner_key, se existir
SET @idx := (
  SELECT INDEX_NAME
  FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND INDEX_NAME = 'uniq_owner_key'
);
SET @sql_idx := IF(
  @tbl > 0 AND @idx IS NOT NULL,
  'ALTER TABLE email_templates DROP INDEX uniq_owner_key',
  'SELECT 1'
);
PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- Remover coluna owner_master_user_id, se existir
SET @sql_col := IF(
  @tbl > 0 AND @hasOwner > 0,
  'ALTER TABLE email_templates DROP COLUMN owner_master_user_id',
  'SELECT 1'
);
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- Garantir índice único global por template_key
SET @hasUniqKey := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE()
    AND table_name = 'email_templates'
    AND INDEX_NAME = 'uniq_template_key'
);
SET @sql_uk := IF(
  @tbl > 0 AND @hasUniqKey = 0,
  'ALTER TABLE email_templates ADD UNIQUE KEY uniq_template_key (template_key)',
  'SELECT 1'
);
PREPARE stmt_uk FROM @sql_uk;
EXECUTE stmt_uk;
DEALLOCATE PREPARE stmt_uk;

-- tabela marcadora
CREATE TABLE IF NOT EXISTS email_templates_global_fix_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

