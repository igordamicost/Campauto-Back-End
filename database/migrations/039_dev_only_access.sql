-- Migração: DEV como única role com permissões, usuário 2 -> DEV
-- Executa com: mysql -u user -p database < 039_dev_only_access.sql

USE campauto;

-- 1. Criar role DEV (se não existir)
INSERT INTO roles (name, description)
VALUES ('DEV', 'Desenvolvedor - Acesso total. Única role que pode editar MASTER e configurar o sistema.')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 2. Remover TODAS as permissões de TODAS as roles
DELETE FROM role_permissions;

-- 3. Atribuir TODAS as permissões apenas à role DEV
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'DEV' LIMIT 1), id FROM permissions;

-- 4. Alterar usuário id 2 para role DEV
UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'DEV' LIMIT 1)
WHERE id = 2;
