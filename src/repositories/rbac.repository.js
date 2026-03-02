import { db } from "../config/database.js";

/**
 * Repositório para operações de RBAC (Roles e Permissões)
 */
export class RBACRepository {
  /**
   * Busca role por ID
   */
  static async getRoleById(roleId) {
    const [rows] = await db.query(
      "SELECT id, name, description, created_at, updated_at FROM roles WHERE id = ?",
      [roleId]
    );
    return rows[0] || null;
  }

  /**
   * Lista todas as roles
   */
  static async getAllRoles() {
    const [rows] = await db.query(
      "SELECT id, name, description, created_at, updated_at FROM roles ORDER BY id"
    );
    return rows;
  }

  /**
   * Busca permissões de uma role (com info de módulo)
   */
  static async getRolePermissions(roleId) {
    try {
      const [rows] = await db.query(
        `SELECT p.id, p.\`key\`, p.description, p.module, p.module_id,
                COALESCE(m.\`key\`, p.module) AS module_key
         FROM permissions p
         INNER JOIN role_permissions rp ON p.id = rp.permission_id
         LEFT JOIN modules m ON p.module_id = m.id
         WHERE rp.role_id = ?
         ORDER BY COALESCE(m.label, p.module), p.\`key\``,
        [roleId]
      );
      return rows;
    } catch (error) {
      if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") {
        const [rows] = await db.query(
          `SELECT p.id, p.\`key\`, p.description, p.module
           FROM permissions p
           INNER JOIN role_permissions rp ON p.id = rp.permission_id
           WHERE rp.role_id = ?
           ORDER BY p.module, p.\`key\``,
          [roleId]
        );
        return rows.map((r) => ({ ...r, module_id: null, module_key: r.module }));
      }
      throw error;
    }
  }

  /**
   * Busca permissões de um usuário (via role, com info de módulo)
   */
  static async getUserPermissions(userId) {
    try {
      const [rows] = await db.query(
        `SELECT DISTINCT p.id, p.\`key\`, p.description, p.module, p.module_id,
                COALESCE(m.\`key\`, p.module) AS module_key,
                COALESCE(m.label, p.module) AS _order
         FROM permissions p
         INNER JOIN role_permissions rp ON p.id = rp.permission_id
         INNER JOIN users u ON rp.role_id = u.role_id
         LEFT JOIN modules m ON p.module_id = m.id
         WHERE u.id = ?
         ORDER BY _order, p.\`key\``,
        [userId]
      );
      return rows.map(({ _order, ...r }) => r);
    } catch (error) {
      if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") {
        const [rows] = await db.query(
          `SELECT DISTINCT p.id, p.\`key\`, p.description, p.module
           FROM permissions p
           INNER JOIN role_permissions rp ON p.id = rp.permission_id
           INNER JOIN users u ON rp.role_id = u.role_id
           WHERE u.id = ?
           ORDER BY p.module, p.\`key\``,
          [userId]
        );
        return rows.map((r) => ({ ...r, module_id: null, module_key: r.module }));
      }
      throw error;
    }
  }

  /**
   * Busca role de um usuário
   */
  static async getUserRole(userId) {
    const [rows] = await db.query(
      `SELECT r.id, r.name, r.description
       FROM roles r
       INNER JOIN users u ON r.id = u.role_id
       WHERE u.id = ?`,
      [userId]
    );
    return rows[0] || null;
  }

  /**
   * Verifica se usuário tem uma permissão específica
   */
  static async userHasPermission(userId, permissionKey) {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS count
       FROM role_permissions rp
       INNER JOIN users u ON rp.role_id = u.role_id
       INNER JOIN permissions p ON rp.permission_id = p.id
       WHERE u.id = ? AND p.\`key\` = ?`,
      [userId, permissionKey]
    );
    return rows[0].count > 0;
  }

  /**
   * Lista todas as permissões (filtro por module_id ou module string)
   */
  static async getAllPermissions(moduleFilter = null, moduleIdFilter = null) {
    try {
      let query = `SELECT p.id, p.\`key\`, p.description, p.module, p.module_id,
                          COALESCE(m.\`key\`, p.module) AS module_key
                   FROM permissions p
                   LEFT JOIN modules m ON p.module_id = m.id`;
      const params = [];

      if (moduleIdFilter != null) {
        query += " WHERE p.module_id = ?";
        params.push(moduleIdFilter);
      } else if (moduleFilter) {
        query += " WHERE (p.module = ? OR m.`key` = ?)";
        params.push(moduleFilter, moduleFilter);
      }

      query += " ORDER BY COALESCE(m.label, p.module), p.`key`";

      const [rows] = await db.query(query, params);
      return rows;
    } catch (error) {
      if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") {
        const [rows] = await db.query(
          "SELECT id, `key`, description, module, created_at FROM permissions ORDER BY module, `key`"
        );
        return rows.map((r) => ({ ...r, module_id: null, module_key: r.module }));
      }
      throw error;
    }
  }

  /**
   * Atualiza permissões de uma role
   */
  static async updateRolePermissions(roleId, permissionIds) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Remove permissões existentes
      await connection.query(
        "DELETE FROM role_permissions WHERE role_id = ?",
        [roleId]
      );

      // Insere novas permissões
      if (permissionIds && permissionIds.length > 0) {
        const values = permissionIds.map((pid) => [roleId, pid]);
        await connection.query(
          "INSERT INTO role_permissions (role_id, permission_id) VALUES ?",
          [values]
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Busca usuário com role, permissões e módulos
   * Tudo via role_id -> role_permissions -> permissions (sem bypass por nome)
   */
  static async getUserWithPermissions(userId) {
    const [userRows] = await db.query(
      `SELECT u.id, u.name, u.email, u.role_id, r.name AS role_name, r.description AS role_description
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [userId]
    );

    if (userRows.length === 0) return null;

    const user = userRows[0];
    const permissions = await this.getUserPermissions(userId);
    const modules = await this.getUserModules(userId);

    return {
      ...user,
      permissions: permissions.map((p) => p.key),
      permissionsDetail: permissions.map((p) => ({
        id: p.id,
        key: p.key,
        description: p.description,
        module: p.module_key || p.module,
        module_id: p.module_id,
      })),
      modules,
    };
  }

  /**
   * Cria uma nova role
   */
  static async createRole(name, description = null) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        "INSERT INTO roles (name, description) VALUES (?, ?)",
        [name.trim().toUpperCase(), description?.trim() || null]
      );

      await connection.commit();

      return await this.getRoleById(result.insertId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Atualiza uma role
   */
  static async updateRole(roleId, updates) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const updateFields = [];
      const params = [];

      if (updates.name !== undefined) {
        updateFields.push("name = ?");
        params.push(updates.name.trim().toUpperCase());
      }

      if (updates.description !== undefined) {
        updateFields.push("description = ?");
        params.push(updates.description?.trim() || null);
      }

      if (updateFields.length === 0) {
        await connection.rollback();
        throw new Error("Nenhum campo para atualizar");
      }

      params.push(roleId);

      await connection.query(
        `UPDATE roles SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params
      );

      await connection.commit();

      return await this.getRoleById(roleId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Cria uma nova permissão (aceita module_id ou module string)
   */
  static async createPermission(key, description, moduleOrModuleId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      let moduleId = null;
      let moduleStr = null;
      if (moduleOrModuleId != null) {
        if (typeof moduleOrModuleId === "number" || /^\d+$/.test(String(moduleOrModuleId))) {
          moduleId = Number(moduleOrModuleId);
        } else {
          moduleStr = String(moduleOrModuleId).trim();
          try {
            const mod = await this.getModuleByKey(moduleStr);
            if (mod) moduleId = mod.id;
          } catch {
            // modules table pode não existir
          }
        }
      }

      let insertId;
      try {
        const [result] = await connection.query(
          "INSERT INTO permissions (`key`, description, module, module_id) VALUES (?, ?, ?, ?)",
          [key.trim(), description?.trim() || null, moduleStr, moduleId]
        );
        insertId = result.insertId;
      } catch (insertErr) {
        if (insertErr.code === "ER_BAD_FIELD_ERROR") {
          const [result] = await connection.query(
            "INSERT INTO permissions (`key`, description, module) VALUES (?, ?, ?)",
            [key.trim(), description?.trim() || null, moduleStr]
          );
          insertId = result.insertId;
        } else {
          throw insertErr;
        }
      }

      await connection.commit();

      return await this.getPermissionById(insertId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Verifica se uma role existe
   */
  static async roleExists(roleId) {
    const [rows] = await db.query("SELECT id FROM roles WHERE id = ?", [roleId]);
    return rows.length > 0;
  }

  /**
   * Verifica se uma role com nome existe
   */
  static async roleNameExists(name, excludeId = null) {
    let query = "SELECT id FROM roles WHERE name = ?";
    const params = [name.trim().toUpperCase()];
    
    if (excludeId) {
      query += " AND id != ?";
      params.push(excludeId);
    }
    
    const [rows] = await db.query(query, params);
    return rows.length > 0;
  }

  /**
   * Verifica se uma permissão com key existe
   */
  static async permissionKeyExists(key, excludeId = null) {
    let query = "SELECT id FROM permissions WHERE `key` = ?";
    const params = [key.trim()];
    
    if (excludeId) {
      query += " AND id != ?";
      params.push(excludeId);
    }
    
    const [rows] = await db.query(query, params);
    return rows.length > 0;
  }

  /**
   * Verifica se todas as permissões existem
   */
  static async validatePermissionIds(permissionIds) {
    if (!permissionIds || permissionIds.length === 0) {
      return { valid: true, invalidIds: [] };
    }

    const placeholders = permissionIds.map(() => "?").join(",");
    const [rows] = await db.query(
      `SELECT id FROM permissions WHERE id IN (${placeholders})`,
      permissionIds
    );

    const validIds = rows.map((r) => r.id);
    const invalidIds = permissionIds.filter((id) => !validIds.includes(id));

    return {
      valid: invalidIds.length === 0,
      invalidIds,
    };
  }

  /**
   * Verifica se role_id é MASTER (id 1). Autorização apenas por role_id.
   */
  static async isMasterRole(roleId) {
    return roleId === 1;
  }

  // ========== MÓDULOS ==========

  /**
   * Lista todos os módulos
   */
  static async getAllModules() {
    try {
      const [rows] = await db.query(
        "SELECT id, `key`, label, description, icon, `order`, created_at, updated_at FROM modules ORDER BY COALESCE(`order`, 999), label"
      );
      return rows;
    } catch (error) {
      if (error.code === "ER_NO_SUCH_TABLE") return [];
      if (error.code === "ER_BAD_FIELD_ERROR") {
        const [rows] = await db.query(
          "SELECT id, `key`, label, description, created_at, updated_at FROM modules ORDER BY label"
        );
        return rows.map((r) => ({ ...r, icon: null, order: 0 }));
      }
      throw error;
    }
  }

  /**
   * Busca módulo por ID
   */
  static async getModuleById(moduleId) {
    try {
      const [rows] = await db.query(
        "SELECT id, `key`, label, description, icon, `order`, created_at, updated_at FROM modules WHERE id = ?",
        [moduleId]
      );
      return rows[0] || null;
    } catch (error) {
      if (error.code === "ER_BAD_FIELD_ERROR") {
        const [rows] = await db.query(
          "SELECT id, `key`, label, description, created_at, updated_at FROM modules WHERE id = ?",
          [moduleId]
        );
        const r = rows[0];
        return r ? { ...r, icon: null, order: 0 } : null;
      }
      throw error;
    }
  }

  /**
   * Busca módulo por key
   */
  static async getModuleByKey(key) {
    try {
      const [rows] = await db.query(
        "SELECT id, `key`, label, description, icon, `order` FROM modules WHERE `key` = ?",
        [key?.trim()?.toLowerCase()]
      );
      return rows[0] || null;
    } catch (error) {
      if (error.code === "ER_BAD_FIELD_ERROR") {
        const [rows] = await db.query(
          "SELECT id, `key`, label, description FROM modules WHERE `key` = ?",
          [key?.trim()?.toLowerCase()]
        );
        const r = rows[0];
        return r ? { ...r, icon: null, order: 0 } : null;
      }
      throw error;
    }
  }

  /**
   * Verifica se módulo com key existe
   */
  static async moduleKeyExists(key, excludeId = null) {
    let query = "SELECT id FROM modules WHERE `key` = ?";
    const params = [key?.trim()?.toLowerCase()];
    if (excludeId) {
      query += " AND id != ?";
      params.push(excludeId);
    }
    const [rows] = await db.query(query, params);
    return rows.length > 0;
  }

  /**
   * Cria módulo
   */
  static async createModule(key, label, description = null, icon = null, order = 0) {
    const [result] = await db.query(
      "INSERT INTO modules (`key`, label, description, icon, `order`) VALUES (?, ?, ?, ?, ?)",
      [key?.trim()?.toLowerCase(), label?.trim(), description?.trim() || null, icon || null, order ?? 0]
    );
    return await this.getModuleById(result.insertId);
  }

  /**
   * Atualiza módulo
   */
  static async updateModule(moduleId, updates) {
    const updateFields = [];
    const params = [];
    if (updates.key !== undefined) {
      updateFields.push("`key` = ?");
      params.push(updates.key?.trim()?.toLowerCase());
    }
    if (updates.label !== undefined) {
      updateFields.push("label = ?");
      params.push(updates.label?.trim());
    }
    if (updates.description !== undefined) {
      updateFields.push("description = ?");
      params.push(updates.description?.trim() || null);
    }
    if (updates.icon !== undefined) {
      updateFields.push("icon = ?");
      params.push(updates.icon?.trim() || null);
    }
    if (updates.order !== undefined) {
      updateFields.push("`order` = ?");
      params.push(updates.order ?? 0);
    }
    if (updateFields.length === 0) return await this.getModuleById(moduleId);
    params.push(moduleId);
    await db.query(
      `UPDATE modules SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );
    return await this.getModuleById(moduleId);
  }

  /**
   * Exclui módulo
   */
  static async deleteModule(moduleId) {
    await db.query("DELETE FROM modules WHERE id = ?", [moduleId]);
    return true;
  }

  /**
   * Busca módulos que o usuário tem permissão de acessar (derivado das permissões da role)
   * Usa module_id ou module (string) para vincular permissões a módulos
   */
  static async getUserModules(userId) {
    try {
      const [rows] = await db.query(
        `SELECT DISTINCT m.id, m.\`key\`, m.label, m.description, m.icon, m.\`order\`
         FROM modules m
         INNER JOIN permissions p ON (p.module_id = m.id OR (p.module_id IS NULL AND m.\`key\` = p.module))
         INNER JOIN role_permissions rp ON rp.permission_id = p.id
         INNER JOIN users u ON rp.role_id = u.role_id
         WHERE u.id = ?
         ORDER BY COALESCE(m.\`order\`, 999), m.label`,
        [userId]
      );
      return rows;
    } catch (error) {
      if (error.code === "ER_NO_SUCH_TABLE") return [];
      if (error.code === "ER_BAD_FIELD_ERROR") {
        const [rows] = await db.query(
          `SELECT DISTINCT m.id, m.\`key\`, m.label, m.description
           FROM modules m
           INNER JOIN permissions p ON (p.module_id = m.id OR (p.module_id IS NULL AND m.\`key\` = p.module))
           INNER JOIN role_permissions rp ON rp.permission_id = p.id
           INNER JOIN users u ON rp.role_id = u.role_id
           WHERE u.id = ?
           ORDER BY m.label`,
          [userId]
        );
        return rows.map((r) => ({ ...r, icon: null, order: 0 }));
      }
      throw error;
    }
  }

  /**
   * Busca permissão por ID (com module_key)
   */
  static async getPermissionById(permissionId) {
    try {
      const [rows] = await db.query(
        `SELECT p.id, p.\`key\`, p.description, p.module, p.module_id,
                COALESCE(m.\`key\`, p.module) AS module_key
         FROM permissions p
         LEFT JOIN modules m ON p.module_id = m.id
         WHERE p.id = ?`,
        [permissionId]
      );
      return rows[0] || null;
    } catch (error) {
      if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") {
        const [rows] = await db.query(
          "SELECT id, `key`, description, module FROM permissions WHERE id = ?",
          [permissionId]
        );
        const r = rows[0];
        return r ? { ...r, module_id: null, module_key: r.module } : null;
      }
      throw error;
    }
  }

  /**
   * Atualiza uma permissão (aceita module_id ou module string)
   */
  static async updatePermission(permissionId, updates) {
    const updateFields = [];
    const params = [];

    if (updates.key !== undefined) {
      updateFields.push("`key` = ?");
      params.push(updates.key.trim());
    }
    if (updates.description !== undefined) {
      updateFields.push("description = ?");
      params.push(updates.description?.trim() || null);
    }
    if (updates.endpoint_pattern !== undefined) {
      updateFields.push("endpoint_pattern = ?");
      params.push(updates.endpoint_pattern?.trim() || null);
    }
    if (updates.module_id !== undefined) {
      updateFields.push("module_id = ?");
      params.push(updates.module_id != null ? Number(updates.module_id) : null);
    }
    if (updates.module !== undefined) {
      const mod = await this.getModuleByKey(updates.module);
      updateFields.push("module_id = ?");
      params.push(mod ? mod.id : null);
      updateFields.push("module = ?");
      params.push(updates.module?.trim() || null);
    }

    if (updateFields.length === 0) return await this.getPermissionById(permissionId);

    params.push(permissionId);
    await db.query(
      `UPDATE permissions SET ${updateFields.join(", ")} WHERE id = ?`,
      params
    );
    return await this.getPermissionById(permissionId);
  }

  /**
   * Exclui uma permissão (remove associações em role_permissions via CASCADE)
   */
  static async deletePermission(permissionId) {
    await db.query("DELETE FROM permissions WHERE id = ?", [permissionId]);
    return true;
  }
}
