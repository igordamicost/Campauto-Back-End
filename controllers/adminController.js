import { db } from "../src/config/database.js";
import { RBACRepository } from "../src/repositories/rbac.repository.js";
import bcrypt from "bcryptjs";

/**
 * Verifica se a tabela roles existe no banco
 */
async function rolesTableExists() {
  try {
    // Tentar fazer uma query simples na tabela roles
    await db.query("SELECT 1 FROM roles LIMIT 1");
    return true;
  } catch (error) {
    // Se der erro (tabela não existe), retornar false
    if (error.code === "ER_NO_SUCH_TABLE" || error.code === "42S02") {
      return false;
    }
    // Se for outro erro, também retornar false para segurança
    console.warn("Erro ao verificar tabela roles:", error.message);
    return false;
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Lista usuários
 */
async function listUsers(req, res) {
  try {
    // Converter query params para números inteiros
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(1000, parseInt(req.query.limit) || 20)); // Máximo 1000 por página
    const offset = (page - 1) * limit;
    const q = req.query.q ? String(req.query.q).trim() : null;

    let whereSql = "";
    const params = [];

    if (q && q.length > 0) {
      whereSql = "WHERE u.name LIKE ? OR u.email LIKE ?";
      params.push(`%${q}%`, `%${q}%`);
    }

    // Verificar se a tabela roles existe antes de fazer JOIN
    const hasRolesTable = await rolesTableExists();
    
    let rows = [];
    
    try {
      if (hasRolesTable) {
        // Fazer JOIN com roles se a tabela existir
        const query = `SELECT u.id, u.name, u.email, u.role_id, u.empresa_id, u.blocked, u.created_at,
                              r.name AS role_name, r.description AS role_description
                       FROM users u
                       LEFT JOIN roles r ON u.role_id = r.id
                       ${whereSql}
                       ORDER BY u.created_at DESC
                       LIMIT ? OFFSET ?`;
        
        [rows] = await db.query(query, [...params, parseInt(limit), parseInt(offset)]);
      } else {
        // Se não existir, usar apenas a coluna role (sistema antigo)
        const query = `SELECT u.id, u.name, u.email, u.empresa_id, u.blocked, u.created_at,
                              u.role AS role_name,
                              NULL AS role_description,
                              NULL AS role_id
                       FROM users u
                       ${whereSql}
                       ORDER BY u.created_at DESC
                       LIMIT ? OFFSET ?`;
        
        [rows] = await db.query(query, [...params, parseInt(limit), parseInt(offset)]);
      }
    } catch (queryError) {
      // Se der erro (ex: coluna role_id não existe), tentar query mais simples
      if (queryError.code === "ER_BAD_FIELD_ERROR" || queryError.message.includes("role_id")) {
        console.warn("Coluna role_id não encontrada, usando query simplificada:", queryError.message);
        const query = `SELECT u.id, u.name, u.email, u.empresa_id, u.blocked, u.created_at,
                              u.role AS role_name,
                              NULL AS role_description,
                              NULL AS role_id
                       FROM users u
                       ${whereSql}
                       ORDER BY u.created_at DESC
                       LIMIT ? OFFSET ?`;
        
        [rows] = await db.query(query, [...params, parseInt(limit), parseInt(offset)]);
      } else {
        throw queryError; // Re-throw se for outro erro
      }
    }
    
    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM users u ${whereSql}`,
      params
    );

    return res.json({
      data: rows,
      total: parseInt(countRow.total) || 0,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error("Error listing users:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    return res.status(500).json({ 
      message: "Erro ao listar usuários",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
}

/**
 * Busca usuário por ID
 */
async function getUserById(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, u.cpf, u.telefone, u.role_id, u.empresa_id, u.blocked, u.created_at,
              r.name AS role_name, r.description AS role_description
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const user = rows[0];
    const permissions = await RBACRepository.getRolePermissions(user.role_id);

    return res.json({
      ...user,
      permissions: permissions.map((p) => p.key),
      permissionsDetail: permissions,
    });
  } catch (error) {
    console.error("Error getting user:", error);
    return res.status(500).json({ message: "Erro ao buscar usuário" });
  }
}

/**
 * Cria usuário
 */
async function createUser(req, res) {
  try {
    const { name, email, password, role_id, empresa_id, cpf, telefone } = req.body;

    if (!name || !email || !password || !role_id) {
      return res.status(400).json({
        message: "Campos obrigatórios: name, email, password, role_id",
      });
    }

    // Verificar se email já existe
    const [existing] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Email já cadastrado" });
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 12);

    // Criar usuário
    const [result] = await db.query(
      `INSERT INTO users (name, email, password, role_id, empresa_id, cpf, telefone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, passwordHash, role_id, empresa_id != null ? Number(empresa_id) : null, cpf || null, telefone || null]
    );

    // Buscar usuário criado
    const [newUserRows] = await db.query(
      `SELECT u.id, u.name, u.email, u.cpf, u.telefone, u.role_id, u.empresa_id, u.blocked, u.created_at,
              r.name AS role_name, r.description AS role_description
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [result.insertId]
    );

    const newUser = newUserRows[0];
    const permissions = await RBACRepository.getRolePermissions(newUser.role_id);

    return res.status(201).json({
      ...newUser,
      permissions: permissions.map((p) => p.key),
      permissionsDetail: permissions,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ message: "Erro ao criar usuário" });
  }
}

/**
 * Atualiza usuário
 */
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { name, email, password, role_id, empresa_id, cpf, telefone, blocked } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name);
    }

    if (email !== undefined) {
      // Verificar se email já existe em outro usuário
      const [existing] = await db.query(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        [email, id]
      );

      if (existing.length > 0) {
        return res.status(400).json({ message: "Email já cadastrado" });
      }

      updates.push("email = ?");
      params.push(email);
    }

    if (password !== undefined) {
      const passwordHash = await bcrypt.hash(password, 12);
      updates.push("password = ?");
      params.push(passwordHash);
    }

    if (role_id !== undefined) {
      updates.push("role_id = ?");
      params.push(role_id);
    }

    if (empresa_id !== undefined) {
      updates.push("empresa_id = ?");
      params.push(empresa_id != null && empresa_id !== "" ? Number(empresa_id) : null);
    }

    if (cpf !== undefined) {
      updates.push("cpf = ?");
      params.push(cpf);
    }

    if (telefone !== undefined) {
      updates.push("telefone = ?");
      params.push(telefone);
    }

    if (blocked !== undefined) {
      updates.push("blocked = ?");
      params.push(blocked ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    params.push(id);

    await db.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    // Buscar usuário atualizado
    const [updatedRows] = await db.query(
      `SELECT u.id, u.name, u.email, u.cpf, u.telefone, u.role_id, u.empresa_id, u.blocked, u.created_at,
              r.name AS role_name, r.description AS role_description
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [id]
    );

    if (updatedRows.length === 0) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const updatedUser = updatedRows[0];
    const permissions = await RBACRepository.getRolePermissions(updatedUser.role_id);

    return res.json({
      ...updatedUser,
      permissions: permissions.map((p) => p.key),
      permissionsDetail: permissions,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({ message: "Erro ao atualizar usuário" });
  }
}

/**
 * Remove usuário
 */
async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    // Não permitir deletar a si mesmo
    if (Number(id) === req.user.userId) {
      return res.status(400).json({ message: "Não é possível deletar seu próprio usuário" });
    }

    await db.query("DELETE FROM users WHERE id = ?", [id]);

    return res.json({ message: "Usuário removido com sucesso" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ message: "Erro ao remover usuário" });
  }
}

/**
 * Lista roles (oculta DEV para usuários não-DEV)
 */
async function listRoles(req, res) {
  try {
    const roles = await RBACRepository.getAllRoles();
    const isDev = String(req.user?.role || "").toUpperCase() === "DEV";

    const filtered = isDev ? roles : roles.filter((r) => String(r.name || "").toUpperCase() !== "DEV");

    return res.json({ data: filtered });
  } catch (error) {
    console.error("Error listing roles:", error);
    return res.status(500).json({ message: "Erro ao listar roles" });
  }
}

/**
 * Busca role por ID (oculta DEV para não-DEV)
 */
async function getRoleById(req, res) {
  try {
    const { id } = req.params;
    const role = await RBACRepository.getRoleById(id);

    if (!role) {
      return res.status(404).json({ message: "Role não encontrada" });
    }

    const isDev = String(req.user?.role || "").toUpperCase() === "DEV";
    if (!isDev && String(role.name || "").toUpperCase() === "DEV") {
      return res.status(404).json({ message: "Role não encontrada" });
    }

    return res.json(role);
  } catch (error) {
    console.error("Error getting role:", error);
    return res.status(500).json({ message: "Erro ao buscar role" });
  }
}

/**
 * Cria nova role
 */
async function createRole(req, res) {
  try {
    const { name, description } = req.body;

    // Validações
    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Nome da role é obrigatório" });
    }

    // Verificar se já existe
    const exists = await RBACRepository.roleNameExists(name);
    if (exists) {
      return res.status(409).json({ message: "Role com este nome já existe" });
    }

    const role = await RBACRepository.createRole(name, description);

    return res.status(201).json(role);
  } catch (error) {
    console.error("Error creating role:", error);
    
    // Erro de duplicação
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Role com este nome já existe" });
    }

    return res.status(500).json({ message: "Erro ao criar role" });
  }
}

/**
 * Atualiza role (apenas DEV pode editar MASTER)
 */
async function updateRole(req, res) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const role = await RBACRepository.getRoleById(id);
    if (!role) {
      return res.status(404).json({ message: "Role não encontrada" });
    }

    const isDev = String(req.user?.role || "").toUpperCase() === "DEV";
    if (String(role.name || "").toUpperCase() === "MASTER" && !isDev) {
      return res.status(403).json({
        message: "Apenas usuários com role DEV podem editar a role MASTER",
      });
    }

    if (role.name === "MASTER" && name && name !== "MASTER") {
      return res.status(400).json({
        message: "Não é permitido alterar o nome da role MASTER",
      });
    }

    // Verificar unicidade se nome mudou
    if (name && name !== role.name) {
      const exists = await RBACRepository.roleNameExists(name, id);
      if (exists) {
        return res.status(409).json({ message: "Role com este nome já existe" });
      }
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    const updatedRole = await RBACRepository.updateRole(id, updates);

    return res.json(updatedRole);
  } catch (error) {
    console.error("Error updating role:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Role com este nome já existe" });
    }

    return res.status(500).json({ message: "Erro ao atualizar role" });
  }
}

/**
 * Lista permissões (filtro opcional: ?module= ou ?module_id=)
 */
async function listPermissions(req, res) {
  try {
    const { module, module_id } = req.query;
    const moduleId = module_id != null ? parseInt(module_id, 10) : null;
    const permissions = await RBACRepository.getAllPermissions(
      module || null,
      !Number.isNaN(moduleId) ? moduleId : null
    );
    return res.json({ data: permissions });
  } catch (error) {
    console.error("Error listing permissions:", error);
    return res.status(500).json({ message: "Erro ao listar permissões" });
  }
}

/**
 * Busca permissões de uma role
 */
async function getRolePermissions(req, res) {
  try {
    const { id } = req.params;

    // Buscar role
    const role = await RBACRepository.getRoleById(id);
    if (!role) {
      return res.status(404).json({ message: "Role não encontrada" });
    }

    // Buscar permissões
    const permissions = await RBACRepository.getRolePermissions(id);

    return res.json({
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
      },
      permissions: permissions,
    });
  } catch (error) {
    console.error("Error getting role permissions:", error);
    return res.status(500).json({ message: "Erro ao buscar permissões da role" });
  }
}

/**
 * Atualiza permissões de uma role (apenas DEV pode editar MASTER)
 */
async function updateRolePermissions(req, res) {
  try {
    const { id } = req.params;
    const { permission_ids } = req.body;

    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({ message: "permission_ids deve ser um array" });
    }

    const role = await RBACRepository.getRoleById(id);
    if (!role) {
      return res.status(404).json({ message: "Role não encontrada" });
    }

    const isDev = String(req.user?.role || "").toUpperCase() === "DEV";
    if (String(role.name || "").toUpperCase() === "MASTER" && !isDev) {
      return res.status(403).json({
        message: "Apenas usuários com role DEV podem editar as permissões da role MASTER",
      });
    }

    // Proteção: MASTER e DEV devem ter pelo menos uma permissão
    const roleName = String(role.name || "").toUpperCase();
    if ((roleName === "MASTER" || roleName === "DEV") && permission_ids.length === 0) {
      return res.status(400).json({
        message: "Role MASTER/DEV deve ter pelo menos uma permissão",
      });
    }

    // Validar que todas as permissões existem
    if (permission_ids.length > 0) {
      const validation = await RBACRepository.validatePermissionIds(permission_ids);
      if (!validation.valid) {
        return res.status(400).json({
          message: "Uma ou mais permissões não existem",
          invalid_ids: validation.invalidIds,
        });
      }
    }

    // Atualizar permissões
    await RBACRepository.updateRolePermissions(id, permission_ids);

    // Buscar permissões atualizadas
    const permissions = await RBACRepository.getRolePermissions(id);

    return res.json({
      message: "Permissões atualizadas com sucesso",
      role_id: Number(id),
      permissions: permissions,
    });
  } catch (error) {
    console.error("Error updating role permissions:", error);
    return res.status(500).json({ message: "Erro ao atualizar permissões" });
  }
}

/**
 * Atualiza permissão
 */
async function updatePermission(req, res) {
  try {
    const { id } = req.params;
    const { key, description, module } = req.body;

    const permission = await RBACRepository.getPermissionById(id);
    if (!permission) {
      return res.status(404).json({ message: "Permissão não encontrada" });
    }

    const updates = {};
    if (key !== undefined) {
      if (!key || key.trim() === "") {
        return res.status(400).json({ message: "Key da permissão não pode ser vazia" });
      }
      const keyPattern = /^[a-z0-9_]+\.[a-z0-9_.]+$/i;
      if (!keyPattern.test(key.trim())) {
        return res.status(400).json({
          message: "Formato de key inválido. Use o formato: module.action (ex: sales.read)",
        });
      }
      const exists = await RBACRepository.permissionKeyExists(key, id);
      if (exists) {
        return res.status(409).json({ message: "Permissão com esta key já existe" });
      }
      updates.key = key;
    }
    if (description !== undefined) updates.description = description;
    if (req.body.module_id !== undefined) updates.module_id = req.body.module_id;
    if (module !== undefined) updates.module = module;
    if (req.body.endpoint_pattern !== undefined) updates.endpoint_pattern = req.body.endpoint_pattern;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    const updated = await RBACRepository.updatePermission(id, updates);
    return res.json(updated);
  } catch (error) {
    console.error("Error updating permission:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Permissão com esta key já existe" });
    }
    return res.status(500).json({ message: "Erro ao atualizar permissão" });
  }
}

/**
 * Exclui permissão (remove associações em role_permissions via CASCADE)
 */
async function deletePermission(req, res) {
  try {
    const { id } = req.params;

    const permission = await RBACRepository.getPermissionById(id);
    if (!permission) {
      return res.status(404).json({ message: "Permissão não encontrada" });
    }

    await RBACRepository.deletePermission(id);
    return res.json({ message: "Permissão excluída com sucesso" });
  } catch (error) {
    console.error("Error deleting permission:", error);
    return res.status(500).json({ message: "Erro ao excluir permissão" });
  }
}

/**
 * Cria nova permissão (aceita module_id ou module string)
 */
async function createPermission(req, res) {
  try {
    const { key, description, module, module_id } = req.body;

    if (!key || key.trim() === "") {
      return res.status(400).json({ message: "Key da permissão é obrigatória" });
    }

    if (!description || description.trim() === "") {
      return res.status(400).json({ message: "Descrição da permissão é obrigatória" });
    }

    const moduleOrId = module_id != null ? Number(module_id) : (module?.trim() || null);
    if (moduleOrId == null || (typeof moduleOrId === "string" && !moduleOrId)) {
      return res.status(400).json({ message: "Módulo da permissão é obrigatório (module_id ou module)" });
    }

    const keyPattern = /^[a-z0-9_]+\.[a-z0-9_.]+$/i;
    if (!keyPattern.test(key.trim())) {
      return res.status(400).json({
        message: "Formato de key inválido. Use o formato: module.action (ex: sales.read)",
      });
    }

    const exists = await RBACRepository.permissionKeyExists(key);
    if (exists) {
      return res.status(409).json({ message: "Permissão com esta key já existe" });
    }

    const permission = await RBACRepository.createPermission(key, description, moduleOrId);

    return res.status(201).json(permission);
  } catch (error) {
    console.error("Error creating permission:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Permissão com esta key já existe" });
    }

    return res.status(500).json({ message: "Erro ao criar permissão" });
  }
}

// ========== MÓDULOS ==========

async function listModules(req, res) {
  try {
    const modules = await RBACRepository.getAllModules();
    return res.json({ data: modules });
  } catch (error) {
    console.error("Error listing modules:", error);
    return res.status(500).json({ message: "Erro ao listar módulos" });
  }
}

async function getModuleById(req, res) {
  try {
    const { id } = req.params;
    const module = await RBACRepository.getModuleById(id);

    if (!module) {
      return res.status(404).json({ message: "Módulo não encontrado" });
    }

    return res.json(module);
  } catch (error) {
    console.error("Error getting module:", error);
    return res.status(500).json({ message: "Erro ao buscar módulo" });
  }
}

async function createModule(req, res) {
  try {
    const { key, label, description } = req.body;

    if (!key || key.trim() === "") {
      return res.status(400).json({ message: "Key do módulo é obrigatória" });
    }

    if (!label || label.trim() === "") {
      return res.status(400).json({ message: "Label do módulo é obrigatório" });
    }

    const exists = await RBACRepository.moduleKeyExists(key);
    if (exists) {
      return res.status(409).json({ message: "Módulo com esta key já existe" });
    }

    const module = await RBACRepository.createModule(key, label, description);

    return res.status(201).json(module);
  } catch (error) {
    console.error("Error creating module:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Módulo com esta key já existe" });
    }

    return res.status(500).json({ message: "Erro ao criar módulo" });
  }
}

async function updateModule(req, res) {
  try {
    const { id } = req.params;
    const { key, label, description } = req.body;

    const module = await RBACRepository.getModuleById(id);
    if (!module) {
      return res.status(404).json({ message: "Módulo não encontrado" });
    }

    const updates = {};
    if (key !== undefined) updates.key = key;
    if (label !== undefined) updates.label = label;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    if (key && key !== module.key) {
      const exists = await RBACRepository.moduleKeyExists(key, id);
      if (exists) {
        return res.status(409).json({ message: "Módulo com esta key já existe" });
      }
    }

    const updated = await RBACRepository.updateModule(id, updates);

    return res.json(updated);
  } catch (error) {
    console.error("Error updating module:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Módulo com esta key já existe" });
    }

    return res.status(500).json({ message: "Erro ao atualizar módulo" });
  }
}

async function deleteModule(req, res) {
  try {
    const { id } = req.params;

    const module = await RBACRepository.getModuleById(id);
    if (!module) {
      return res.status(404).json({ message: "Módulo não encontrado" });
    }

    await RBACRepository.deleteModule(id);

    return res.json({ message: "Módulo excluído com sucesso" });
  } catch (error) {
    console.error("Error deleting module:", error);
    return res.status(500).json({ message: "Erro ao excluir módulo" });
  }
}

export default {
  listUsers: asyncHandler(listUsers),
  getUserById: asyncHandler(getUserById),
  createUser: asyncHandler(createUser),
  updateUser: asyncHandler(updateUser),
  deleteUser: asyncHandler(deleteUser),
  listRoles: asyncHandler(listRoles),
  getRoleById: asyncHandler(getRoleById),
  createRole: asyncHandler(createRole),
  updateRole: asyncHandler(updateRole),
  listPermissions: asyncHandler(listPermissions),
  createPermission: asyncHandler(createPermission),
  updatePermission: asyncHandler(updatePermission),
  deletePermission: asyncHandler(deletePermission),
  getRolePermissions: asyncHandler(getRolePermissions),
  updateRolePermissions: asyncHandler(updateRolePermissions),
  listModules: asyncHandler(listModules),
  getModuleById: asyncHandler(getModuleById),
  createModule: asyncHandler(createModule),
  updateModule: asyncHandler(updateModule),
  deleteModule: asyncHandler(deleteModule),
};
