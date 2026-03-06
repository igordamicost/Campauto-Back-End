-- Migration 056: Módulo Vínculos - Produtos e Fábricas
-- Tabelas: produto_vinculos, fabricas, produto_fabrica
-- Permissões, role "Gestor de Vínculos", menu

-- ========== 1. Tabela produto_vinculos (vínculos entre produtos similares) ==========
CREATE TABLE IF NOT EXISTS produto_vinculos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto_id_origem INT NOT NULL,
  produto_id_vinculado INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_vinculo (produto_id_origem, produto_id_vinculado),
  CONSTRAINT fk_pv_origem FOREIGN KEY (produto_id_origem) REFERENCES produtos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pv_vinculado FOREIGN KEY (produto_id_vinculado) REFERENCES produtos(id) ON DELETE CASCADE,
  CONSTRAINT chk_pv_diferentes CHECK (produto_id_origem != produto_id_vinculado),
  INDEX idx_pv_origem (produto_id_origem),
  INDEX idx_pv_vinculado (produto_id_vinculado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 2. Tabela fabricas ==========
CREATE TABLE IF NOT EXISTS fabricas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  codigo VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_fabrica_nome (nome),
  INDEX idx_fabrica_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 3. Tabela produto_fabrica (N:N) ==========
CREATE TABLE IF NOT EXISTS produto_fabrica (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto_id INT NOT NULL,
  fabrica_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_produto_fabrica (produto_id, fabrica_id),
  CONSTRAINT fk_pf_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pf_fabrica FOREIGN KEY (fabrica_id) REFERENCES fabricas(id) ON DELETE CASCADE,
  INDEX idx_pf_produto (produto_id),
  INDEX idx_pf_fabrica (fabrica_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 4. Módulo vinculos ==========
INSERT IGNORE INTO modules (`key`, label, description, icon, `order`) VALUES
  ('vinculos', 'Vínculos', 'Vínculos entre produtos e fábricas', 'Link', 20);

-- ========== 5. Permissões vinculos ==========
INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'vinculos.read', 'Visualizar vínculos de produtos e fábricas', 'vinculos', id FROM modules WHERE `key` = 'vinculos' LIMIT 1;

INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'vinculos.create', 'Criar vínculos e cadastrar fábricas', 'vinculos', id FROM modules WHERE `key` = 'vinculos' LIMIT 1;

INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'vinculos.update', 'Editar vínculos e fábricas', 'vinculos', id FROM modules WHERE `key` = 'vinculos' LIMIT 1;

INSERT IGNORE INTO permissions (`key`, description, module, module_id)
SELECT 'vinculos.delete', 'Remover vínculos e fábricas', 'vinculos', id FROM modules WHERE `key` = 'vinculos' LIMIT 1;

-- ========== 6. Role Gestor de Vínculos ==========
INSERT INTO roles (name, description)
VALUES ('Gestor de Vínculos', 'Gestão de vínculos entre produtos e cadastro de fábricas')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ========== 7. Atribuir permissões vinculos à role Gestor de Vínculos ==========
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'Gestor de Vínculos' LIMIT 1), id FROM permissions WHERE `key` IN ('vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.delete');

-- ========== 8. Dar permissões vinculos às roles DEV e MASTER ==========
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'DEV' LIMIT 1), id FROM permissions WHERE `key` IN ('vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.delete');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE name = 'MASTER' LIMIT 1), id FROM permissions WHERE `key` IN ('vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.delete');

-- ========== 9. Menu Vínculos (também em 044; aqui como fallback) ==========
INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT NULL, 'vinculos', 'Vínculos', NULL, 'Link', 20, 'vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.update', 'vinculos.delete'
FROM (SELECT 1) t
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE module_key = 'vinculos' AND parent_id IS NULL);

INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT m.id, 'vinculos', 'Vínculos de Produtos', '/dashboard/vinculos/produtos', 'Link', 0, 'vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.update', 'vinculos.delete'
FROM menu_items m WHERE m.module_key = 'vinculos' AND m.parent_id IS NULL
AND NOT EXISTS (SELECT 1 FROM menu_items c WHERE c.parent_id = m.id AND c.path = '/dashboard/vinculos/produtos');

INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT m.id, 'vinculos', 'Fábricas', '/dashboard/vinculos/fabricas', 'Building2', 1, 'vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.update', 'vinculos.delete'
FROM menu_items m WHERE m.module_key = 'vinculos' AND m.parent_id IS NULL
AND NOT EXISTS (SELECT 1 FROM menu_items c WHERE c.parent_id = m.id AND c.path = '/dashboard/vinculos/fabricas');
