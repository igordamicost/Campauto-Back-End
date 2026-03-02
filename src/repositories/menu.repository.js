import { db } from "../config/database.js";

/**
 * Repositório para menu_items
 */
export class MenuRepository {
  /**
   * Lista todos os itens do menu (flat, ordenados)
   */
  static async getAll() {
    try {
      const [rows] = await db.query(
        `SELECT id, parent_id, module_key, label, path, icon, \`order\`,
                permission, permission_create, permission_update,
                permission_update_partial, permission_delete,
                created_at, updated_at
         FROM menu_items
         ORDER BY COALESCE(parent_id, 0), \`order\`, id`
      );
      return rows;
    } catch (error) {
      if (error.code === "ER_NO_SUCH_TABLE") return [];
      throw error;
    }
  }

  /**
   * Busca item por ID
   */
  static async getById(id) {
    const [rows] = await db.query(
      `SELECT id, parent_id, module_key, label, path, icon, \`order\`,
              permission, permission_create, permission_update,
              permission_update_partial, permission_delete,
              created_at, updated_at
       FROM menu_items WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Cria item do menu
   */
  static async create(data) {
    const [result] = await db.query(
      `INSERT INTO menu_items (
        parent_id, module_key, label, path, icon, \`order\`,
        permission, permission_create, permission_update,
        permission_update_partial, permission_delete
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.parent_id ?? null,
        data.module_key ?? null,
        data.label,
        data.path ?? null,
        data.icon ?? null,
        data.order ?? 0,
        data.permission ?? null,
        data.permission_create ?? null,
        data.permission_update ?? null,
        data.permission_update_partial ?? null,
        data.permission_delete ?? null,
      ]
    );
    return await this.getById(result.insertId);
  }

  /**
   * Atualiza item do menu
   */
  static async update(id, data) {
    const fields = [];
    const values = [];

    const map = {
      parent_id: "parent_id",
      module_key: "module_key",
      label: "label",
      path: "path",
      icon: "icon",
      order: "`order`",
      permission: "permission",
      permission_create: "permission_create",
      permission_update: "permission_update",
      permission_update_partial: "permission_update_partial",
      permission_delete: "permission_delete",
    };

    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(data[key] ?? null);
      }
    }

    if (fields.length === 0) return await this.getById(id);

    values.push(id);
    await db.query(`UPDATE menu_items SET ${fields.join(", ")} WHERE id = ?`, values);
    return await this.getById(id);
  }

  /**
   * Exclui item (cascade em children)
   */
  static async delete(id) {
    await db.query("DELETE FROM menu_items WHERE id = ?", [id]);
    return true;
  }
}
