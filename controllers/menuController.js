import { MenuRepository } from "../src/repositories/menu.repository.js";
import { RBACRepository } from "../src/repositories/rbac.repository.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * GET /menu - Menu do usuário filtrado por permissões
 * Para DEV: retorna tudo. Para demais: filtra por hasPermission(item.permission)
 */
async function getMenu(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    const allItems = await MenuRepository.getAll();
    const userPerms = await RBACRepository.getUserPermissions(userId);
    const permSet = new Set(userPerms.map((p) => p.key));
    const filtered = allItems.filter((item) => !item.permission || permSet.has(item.permission));

    const tree = buildTree(filtered, null);
    return res.json(tree);
  } catch (error) {
    console.error("Error getting menu:", error);
    return res.status(500).json({ message: "Erro ao buscar menu" });
  }
}

function buildTree(items, parentId) {
  return items
    .filter((i) => (parentId == null ? !i.parent_id : i.parent_id === parentId))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((item) => ({
      id: item.id,
      parent_id: item.parent_id,
      module_key: item.module_key,
      label: item.label,
      path: item.path,
      icon: item.icon,
      order: item.order,
      permission: item.permission,
      permission_create: item.permission_create,
      permission_update: item.permission_update,
      permission_update_partial: item.permission_update_partial,
      permission_delete: item.permission_delete,
      children: buildTree(items, item.id),
    }));
}

/**
 * GET /admin/menu - Lista todos os itens (apenas DEV)
 */
async function listAdminMenu(req, res) {
  try {
    const items = await MenuRepository.getAll();
    const tree = buildTree(items, null);
    return res.json({ data: tree });
  } catch (error) {
    console.error("Error listing admin menu:", error);
    return res.status(500).json({ message: "Erro ao listar menu" });
  }
}

/**
 * POST /admin/menu - Cria item (apenas DEV)
 */
async function createMenuItem(req, res) {
  try {
    const body = req.body || {};
    if (!body.label || String(body.label).trim() === "") {
      return res.status(400).json({ message: "label é obrigatório" });
    }

    const item = await MenuRepository.create({
      parent_id: body.parent_id,
      module_key: body.module_key,
      label: body.label.trim(),
      path: body.path,
      icon: body.icon,
      order: body.order ?? 0,
      permission: body.permission,
      permission_create: body.permission_create,
      permission_update: body.permission_update,
      permission_update_partial: body.permission_update_partial,
      permission_delete: body.permission_delete,
    });

    return res.status(201).json(item);
  } catch (error) {
    console.error("Error creating menu item:", error);
    return res.status(500).json({ message: "Erro ao criar item do menu" });
  }
}

/**
 * PUT /admin/menu/:id - Atualiza item (apenas DEV)
 */
async function updateMenuItem(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const existing = await MenuRepository.getById(id);
    if (!existing) {
      return res.status(404).json({ message: "Item do menu não encontrado" });
    }

    const updates = {};
    if (body.parent_id !== undefined) updates.parent_id = body.parent_id;
    if (body.module_key !== undefined) updates.module_key = body.module_key;
    if (body.label !== undefined) updates.label = body.label;
    if (body.path !== undefined) updates.path = body.path;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.order !== undefined) updates.order = body.order;
    if (body.permission !== undefined) updates.permission = body.permission;
    if (body.permission_create !== undefined) updates.permission_create = body.permission_create;
    if (body.permission_update !== undefined) updates.permission_update = body.permission_update;
    if (body.permission_update_partial !== undefined) updates.permission_update_partial = body.permission_update_partial;
    if (body.permission_delete !== undefined) updates.permission_delete = body.permission_delete;

    const updated = await MenuRepository.update(id, updates);
    return res.json(updated);
  } catch (error) {
    console.error("Error updating menu item:", error);
    return res.status(500).json({ message: "Erro ao atualizar item do menu" });
  }
}

/**
 * DELETE /admin/menu/:id - Remove item (apenas DEV)
 */
async function deleteMenuItem(req, res) {
  try {
    const { id } = req.params;

    const existing = await MenuRepository.getById(id);
    if (!existing) {
      return res.status(404).json({ message: "Item do menu não encontrado" });
    }

    await MenuRepository.delete(id);
    return res.json({ message: "Item do menu excluído com sucesso" });
  } catch (error) {
    console.error("Error deleting menu item:", error);
    return res.status(500).json({ message: "Erro ao excluir item do menu" });
  }
}

export default {
  getMenu: asyncHandler(getMenu),
  listAdminMenu: asyncHandler(listAdminMenu),
  createMenuItem: asyncHandler(createMenuItem),
  updateMenuItem: asyncHandler(updateMenuItem),
  deleteMenuItem: asyncHandler(deleteMenuItem),
};
