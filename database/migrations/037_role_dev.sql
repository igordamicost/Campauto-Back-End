-- Migração: Role DEV e usuário id 2
-- Executa com: mysql -u user -p database < 037_role_dev.sql

USE campauto;

-- 1) Inserir role DEV (se não existir)
INSERT INTO roles (name, description)
VALUES ('DEV', 'Desenvolvedor - Acesso total para configuração do sistema')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 2) Atribuir todas as permissões à role DEV
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'DEV';

-- 3) Atualizar usuário id 2 para role DEV
UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'DEV' LIMIT 1)
WHERE id = 2;
