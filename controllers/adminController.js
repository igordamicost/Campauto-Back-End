import { db } from "../src/config/database.js";
import { RBACRepository } from "../src/repositories/rbac.repository.js";
import bcrypt from "bcryptjs";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Lista usuários
 */
async function listUsers(req, res) {
  try {
    const { page = 1, limit = 20, q } = req.query;
    const offset = (page - 1) * limit;

    let whereSql = "";
    const params = [];

    if (q) {
      whereSql = "WHERE u.name LIKE ? OR u.email LIKE ?";
      params.push(`%${q}%`, `%${q}%`);
    }

    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, u.role_id, u.blocked, u.created_at,
              r.name AS role_name, r.description AS role_description
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ${whereSql}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM users u ${whereSql}`,
      params
    );

    return res.json({
      data: rows,
      total: countRow.total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    console.error("Error listing users:", error);
    return res.status(500).json({ message: "Erro ao listar usuários" });
  }
}

/**
 * Busca usuário por ID
 */
async function getUserById(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, u.cpf, u.telefone, u.role_id, u.blocked, u.created_at,
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
    const { name, email, password, role_id, cpf, telefone } = req.body;

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
      `INSERT INTO users (name, email, password, role_id, cpf, telefone)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, passwordHash, role_id, cpf || null, telefone || null]
    );

    // Buscar usuário criado
    const [newUserRows] = await db.query(
      `SELECT u.id, u.name, u.email, u.cpf, u.telefone, u.role_id, u.blocked, u.created_at,
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
    const { name, email, password, role_id, cpf, telefone, blocked } = req.body;

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
      `SELECT u.id, u.name, u.email, u.cpf, u.telefone, u.role_id, u.blocked, u.created_at,
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
 * Lista roles
 */
async function listRoles(req, res) {
  try {
    const roles = await RBACRepository.getAllRoles();
    return res.json({ data: roles });
  } catch (error) {
    console.error("Error listing roles:", error);
    return res.status(500).json({ message: "Erro ao listar roles" });
  }
}

/**
 * Lista permissões
 */
async function listPermissions(req, res) {
  try {
    const permissions = await RBACRepository.getAllPermissions();
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
    const permissions = await RBACRepository.getRolePermissions(id);
    return res.json({ data: permissions });
  } catch (error) {
    console.error("Error getting role permissions:", error);
    return res.status(500).json({ message: "Erro ao buscar permissões da role" });
  }
}

/**
 * Atualiza permissões de uma role
 */
async function updateRolePermissions(req, res) {
  try {
    const { id } = req.params;
    const { permission_ids } = req.body;

    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({ message: "permission_ids deve ser um array" });
    }

    await RBACRepository.updateRolePermissions(id, permission_ids);

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

export default {
  listUsers: asyncHandler(listUsers),
  getUserById: asyncHandler(getUserById),
  createUser: asyncHandler(createUser),
  updateUser: asyncHandler(updateUser),
  deleteUser: asyncHandler(deleteUser),
  listRoles: asyncHandler(listRoles),
  listPermissions: asyncHandler(listPermissions),
  getRolePermissions: asyncHandler(getRolePermissions),
  updateRolePermissions: asyncHandler(updateRolePermissions),
};
