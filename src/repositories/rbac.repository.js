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
   * Busca permissões de uma role
   */
  static async getRolePermissions(roleId) {
    const [rows] = await db.query(
      `SELECT p.id, p.key, p.description, p.module
       FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?
       ORDER BY p.module, p.key`,
      [roleId]
    );
    return rows;
  }

  /**
   * Busca permissões de um usuário (via role)
   */
  static async getUserPermissions(userId) {
    const [rows] = await db.query(
      `SELECT DISTINCT p.id, p.key, p.description, p.module
       FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       INNER JOIN users u ON rp.role_id = u.role_id
       WHERE u.id = ?
       ORDER BY p.module, p.key`,
      [userId]
    );
    return rows;
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
       WHERE u.id = ? AND p.key = ?`,
      [userId, permissionKey]
    );
    return rows[0].count > 0;
  }

  /**
   * Lista todas as permissões
   */
  static async getAllPermissions() {
    const [rows] = await db.query(
      "SELECT id, key, description, module FROM permissions ORDER BY module, key"
    );
    return rows;
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
   * Busca usuário com role e permissões
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

    return {
      ...user,
      permissions: permissions.map((p) => p.key),
      permissionsDetail: permissions,
    };
  }
}
