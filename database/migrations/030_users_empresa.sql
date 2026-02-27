-- Migração: vínculo de usuários com empresas (users.empresa_id)

USE campauto;

-- Adicionar coluna empresa_id se ainda não existir
SET @col_emp := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'empresa_id'
);

SET @sql_emp := IF(
  @col_emp = 0,
  'ALTER TABLE users ADD COLUMN empresa_id INT NULL AFTER role_id',
  'SELECT 1'
);

PREPARE stmt_emp FROM @sql_emp;
EXECUTE stmt_emp;
DEALLOCATE PREPARE stmt_emp;

-- Garantir índice em empresa_id
SET @idx_emp := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND index_name = 'idx_users_empresa_id'
);

SET @sql_idx_emp := IF(
  @idx_emp = 0,
  'ALTER TABLE users ADD INDEX idx_users_empresa_id (empresa_id)',
  'SELECT 1'
);

PREPARE stmt_idx_emp FROM @sql_idx_emp;
EXECUTE stmt_idx_emp;
DEALLOCATE PREPARE stmt_idx_emp;

-- Adicionar FK (se ainda não existir)
SET @fk_emp := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE constraint_schema = DATABASE()
    AND table_name = 'users'
    AND constraint_name = 'fk_users_empresa'
);

SET @sql_fk_emp := IF(
  @fk_emp = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL',
  'SELECT 1'
);

PREPARE stmt_fk_emp FROM @sql_fk_emp;
EXECUTE stmt_fk_emp;
DEALLOCATE PREPARE stmt_fk_emp;

-- Tabela marcador para o MigrationService
CREATE TABLE IF NOT EXISTS users_empresa_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

