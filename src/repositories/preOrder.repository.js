import { db } from "../config/database.js";

/**
 * Repositório para Pré-Pedidos
 */
export class PreOrderRepository {
  static async list(filters = {}) {
    const { page = 1, limit = 20, q, status, orcamento_id } = filters;

    const whereParts = [];
    const params = [];

    if (status) {
      whereParts.push("po.status = ?");
      params.push(status);
    }
    if (orcamento_id) {
      whereParts.push("po.orcamento_id = ?");
      params.push(Number(orcamento_id));
    }
    if (q && String(q).trim()) {
      whereParts.push("o.numero_sequencial = ?");
      params.push(Number(q) || 0);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const offset = (Math.max(1, Number(page)) - 1) * Math.min(100, Number(limit) || 20);
    const limitNum = Math.min(100, Number(limit) || 20);

    const [rows] = await db.query(
      `SELECT po.id, po.orcamento_id, po.status, po.created_at, po.updated_at,
              o.numero_sequencial AS orcamento_numero
       FROM pre_orders po
       LEFT JOIN orcamentos o ON po.orcamento_id = o.id
       ${whereSql}
       ORDER BY po.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM pre_orders po
       LEFT JOIN orcamentos o ON po.orcamento_id = o.id
       ${whereSql}`,
      params
    );

    return { data: rows, total: countRow?.total ?? 0 };
  }

  static async getById(id) {
    const [[order]] = await db.query(
      `SELECT po.*, o.numero_sequencial AS orcamento_numero
       FROM pre_orders po
       LEFT JOIN orcamentos o ON po.orcamento_id = o.id
       WHERE po.id = ?`,
      [id]
    );
    if (!order) return null;

    const [items] = await db.query(
      `SELECT poi.id, poi.product_id, poi.quantity,
              p.descricao AS product_name, p.codigo_produto AS product_code
       FROM pre_order_items poi
       LEFT JOIN produtos p ON poi.product_id = p.id
       WHERE poi.pre_order_id = ?`,
      [id]
    );
    order.items = items;
    return order;
  }

  static async create(data) {
    const { orcamento_id, items } = data;
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        `INSERT INTO pre_orders (orcamento_id, status) VALUES (?, 'created')`,
        [orcamento_id || null]
      );
      const orderId = result.insertId;
      if (items && Array.isArray(items) && items.length > 0) {
        for (const it of items) {
          await connection.query(
            `INSERT INTO pre_order_items (pre_order_id, product_id, quantity)
             VALUES (?, ?, ?)`,
            [orderId, it.product_id, it.quantity]
          );
        }
      }
      await connection.commit();
      return orderId;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  static async updateStatus(id, status) {
    const validStatus = [
      "created",
      "pending_manager_review",
      "approved_for_quote",
      "quoted",
      "supplier_selected",
      "purchased",
      "received",
      "canceled",
    ];
    if (!validStatus.includes(status)) return false;
    const [result] = await db.query(
      "UPDATE pre_orders SET status = ?, updated_at = NOW() WHERE id = ?",
      [status, id]
    );
    return result.affectedRows > 0;
  }

  static async approve(id) {
    return this.updateStatus(id, "approved_for_quote");
  }

  /**
   * Verifica se já existe pre_order para orcamento+produto
   */
  static async findExistingForOrcamentoItem(orcamentoId, productId) {
    const [rows] = await db.query(
      `SELECT po.id FROM pre_orders po
       INNER JOIN pre_order_items poi ON poi.pre_order_id = po.id
       WHERE po.orcamento_id = ? AND poi.product_id = ?
         AND po.status NOT IN ('canceled', 'received')
       LIMIT 1`,
      [orcamentoId, productId]
    );
    return rows[0]?.id || null;
  }
}
