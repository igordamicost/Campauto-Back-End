-- Migração: Remover coluna role da tabela users
-- O controle de acesso passa a ser exclusivamente via role_id (FK -> roles)
-- Executa com: mysql -u user -p database < 041_remove_users_role_column.sql

USE campauto;

-- Remover coluna role (string/ENUM legada)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'role');
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE users DROP COLUMN role',
  'SELECT "Coluna role já foi removida" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
