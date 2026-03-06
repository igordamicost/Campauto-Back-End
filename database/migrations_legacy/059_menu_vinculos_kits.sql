-- Migration 059: Garantir item "Kits" no menu Vínculos
-- Insere o subitem Kits se não existir (corrige ambientes onde 044 rodou antes da inclusão)

INSERT INTO menu_items (parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete)
SELECT m.id, 'vinculos', 'Kits', '/dashboard/vinculos/kits', 'Package', 2, 'vinculos.read', 'vinculos.create', 'vinculos.update', 'vinculos.update', 'vinculos.delete'
FROM menu_items m
WHERE m.module_key = 'vinculos' AND m.parent_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM menu_items c WHERE c.parent_id = m.id AND c.path = '/dashboard/vinculos/kits')
LIMIT 1;
