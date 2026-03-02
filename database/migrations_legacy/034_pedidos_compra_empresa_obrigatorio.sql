-- Migração: empresa_id obrigatório em pedidos_compra

USE campauto;

-- Atualizar linhas com empresa_id NULL para a primeira empresa (se houver)
UPDATE pedidos_compra pc
SET pc.empresa_id = (SELECT e.id FROM empresas e LIMIT 1)
WHERE pc.empresa_id IS NULL
  AND EXISTS (SELECT 1 FROM empresas LIMIT 1);

-- Tornar empresa_id NOT NULL
ALTER TABLE pedidos_compra MODIFY empresa_id INT NOT NULL;

-- Marcar migration como aplicada
CREATE TABLE IF NOT EXISTS pedidos_compra_empresa_obrigatorio_applied (
  id TINYINT PRIMARY KEY DEFAULT 1,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
