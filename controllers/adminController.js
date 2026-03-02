import crypto from "crypto";
import { db } from "../src/config/database.js";
import { RBACRepository } from "../src/repositories/rbac.repository.js";
import { sendPasswordSetupEmail } from "../src/controllers/auth.controller.js";
import bcrypt from "bcryptjs";

/** Gera senha temporária legível (12 chars, sem caracteres ambíguos) */
function generateTemporaryPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let result = "";
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
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

    let rows = [];
    const query = `SELECT u.id, u.name, u.email, u.role_id, u.empresa_id, u.blocked, u.created_at,
                          r.name AS role_name, r.description AS role_description
                   FROM users u
                   LEFT JOIN roles r ON u.role_id = r.id
                   ${whereSql}
                   ORDER BY u.created_at DESC
                   LIMIT ? OFFSET ?`;

    [rows] = await db.query(query, [...params, parseInt(limit), parseInt(offset)]);
    
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
 * Cria usuário.
 * Senha não é obrigatória: se omitida, envia email com link para definir senha (válido 7 dias).
 */
async function createUser(req, res) {
  try {
    const { name, email, password, role_id, empresa_id, cpf, telefone } = req.body;

    if (!name || !email || !role_id) {
      return res.status(400).json({
        message: "Campos obrigatórios: name, email, role_id",
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

    // Senha opcional: se fornecida, usar; senão gerar senha temporária e enviar email
    let passwordHash;
    let mustSetPassword = 0;
    let temporaryPassword = null;

    if (password && String(password).trim() !== "") {
      passwordHash = await bcrypt.hash(password, 12);
    } else {
      temporaryPassword = generateTemporaryPassword();
      passwordHash = await bcrypt.hash(temporaryPassword, 12);
      mustSetPassword = 1;
    }

    // Criar usuário (sempre com password hash - nunca NULL)
    const [result] = await db.query(
      `INSERT INTO users (name, email, password, role_id, empresa_id, cpf, telefone, must_set_password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        email,
        passwordHash,
        role_id,
        empresa_id != null ? Number(empresa_id) : null,
        cpf || null,
        telefone || null,
        mustSetPassword,
      ]
    );

    const userId = result.insertId;

    // Se senha temporária: enviar email com credenciais + link para trocar
    if (mustSetPassword === 1 && temporaryPassword) {
      try {
        await sendPasswordSetupEmail(userId, email, name, {
          templateKey: "FIRST_ACCESS",
          empresaId: empresa_id != null ? Number(empresa_id) : null,
          expiresInHours: 24 * 7, // 7 dias
          temporaryPassword,
        });
      } catch (emailErr) {
        console.error("[createUser] Erro ao enviar email de boas-vindas:", emailErr);
        return res.status(201).json({
          id: userId,
          name,
          email,
          role_id,
          empresa_id: empresa_id != null ? Number(empresa_id) : null,
          message: "Usuário criado, mas falha ao enviar e-mail. O usuário pode solicitar novo link em 'Esqueci minha senha'.",
        });
      }
    }

    // Buscar usuário criado
    const [newUserRows] = await db.query(
      `SELECT u.id, u.name, u.email, u.cpf, u.telefone, u.role_id, u.empresa_id, u.blocked, u.must_set_password, u.created_at,
              r.name AS role_name, r.description AS role_description
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [userId]
    );

    const newUser = newUserRows[0];
    const permissions = await RBACRepository.getRolePermissions(newUser.role_id);

    return res.status(201).json({
      ...newUser,
      permissions: permissions.map((p) => p.key),
      permissionsDetail: permissions,
      message: mustSetPassword === 1 ? "Usuário criado. E-mail enviado para definir senha." : "Usuário criado com sucesso.",
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
 * Lista roles (oculta role DEV para quem não tem system.config)
 */
async function listRoles(req, res) {
  try {
    const roles = await RBACRepository.getAllRoles();
    const hasSystemConfig = await RBACRepository.userHasPermission(req.user?.userId, "system.config");

    const filtered = hasSystemConfig ? roles : roles.filter((r) => String(r.name || "").toUpperCase() !== "DEV");

    return res.json({ data: filtered });
  } catch (error) {
    console.error("Error listing roles:", error);
    return res.status(500).json({ message: "Erro ao listar roles" });
  }
}

/**
 * Busca role por ID (oculta DEV para quem não tem system.config)
 */
async function getRoleById(req, res) {
  try {
    const { id } = req.params;
    const role = await RBACRepository.getRoleById(id);

    if (!role) {
      return res.status(404).json({ message: "Role não encontrada" });
    }

    const hasSystemConfig = await RBACRepository.userHasPermission(req.user?.userId, "system.config");
    if (!hasSystemConfig && String(role.name || "").toUpperCase() === "DEV") {
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
 * Atualiza role (apenas quem tem system.config pode editar MASTER)
 */
async function updateRole(req, res) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const role = await RBACRepository.getRoleById(id);
    if (!role) {
      return res.status(404).json({ message: "Role não encontrada" });
    }

    const hasSystemConfig = await RBACRepository.userHasPermission(req.user?.userId, "system.config");
    if (String(role.name || "").toUpperCase() === "MASTER" && !hasSystemConfig) {
      return res.status(403).json({
        message: "Apenas usuários com permissão system.config podem editar a role MASTER",
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
 * Atualiza permissões de uma role (apenas quem tem system.config pode editar MASTER)
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

    const hasSystemConfig = await RBACRepository.userHasPermission(req.user?.userId, "system.config");
    if (String(role.name || "").toUpperCase() === "MASTER" && !hasSystemConfig) {
      return res.status(403).json({
        message: "Apenas usuários com permissão system.config podem editar as permissões da role MASTER",
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
    const { key, label, description, icon, order } = req.body;

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

    const module = await RBACRepository.createModule(key, label, description, icon, order);

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
    const { key, label, description, icon, order } = req.body;

    const module = await RBACRepository.getModuleById(id);
    if (!module) {
      return res.status(404).json({ message: "Módulo não encontrado" });
    }

    const updates = {};
    if (key !== undefined) updates.key = key;
    if (label !== undefined) updates.label = label;
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;
    if (order !== undefined) updates.order = order;

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
