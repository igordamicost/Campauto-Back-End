import { db } from "../config/database.js";

/**
 * Repositório para operações de Estoque
 */
export class StockRepository {
  /**
   * Busca saldos de estoque
   */
  static async getBalances(filters = {}) {
    const { productId, locationId } = filters;
    const whereParts = [];
    const params = [];

    if (productId) {
      whereParts.push("sb.product_id = ?");
      params.push(productId);
    }

    if (locationId) {
      whereParts.push("sb.location_id = ?");
      params.push(locationId);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT sb.*,
              p.id AS product_id, p.descricao AS product_name, p.codigo AS product_code,
              sl.name AS location_name, sl.code AS location_code
       FROM stock_balances sb
       INNER JOIN produtos p ON sb.product_id = p.id
       LEFT JOIN stock_locations sl ON sb.location_id = sl.id
       ${whereSql}
       ORDER BY p.descricao`,
      params
    );

    return rows;
  }

  /**
   * Busca movimentações de estoque
   */
  static async getMovements(filters = {}) {
    const {
      productId,
      locationId,
      type,
      refType,
      refId,
      limit = 100,
      offset = 0,
    } = filters;

    const whereParts = [];
    const params = [];

    if (productId) {
      whereParts.push("sm.product_id = ?");
      params.push(productId);
    }

    if (locationId) {
      whereParts.push("sm.location_id = ?");
      params.push(locationId);
    }

    if (type) {
      whereParts.push("sm.type = ?");
      params.push(type);
    }

    if (refType) {
      whereParts.push("sm.ref_type = ?");
      params.push(refType);
    }

    if (refId) {
      whereParts.push("sm.ref_id = ?");
      params.push(refId);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT sm.id, sm.product_id, sm.location_id, sm.type, sm.qty, sm.qty_before, sm.qty_after,
              sm.ref_type, sm.ref_id, sm.notes, sm.created_by, sm.created_at,
              p.descricao AS product_name, p.codigo AS product_code,
              u.name AS created_by_name
       FROM stock_movements sm
       LEFT JOIN produtos p ON sm.product_id = p.id
       LEFT JOIN users u ON sm.created_by = u.id
       ${whereSql}
       ORDER BY sm.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM stock_movements sm ${whereSql}`,
      params
    );

    return { data: rows, total: countRow.total };
  }

  /**
   * Cria movimentação de estoque
   */
  static async createMovement(data) {
    const {
      product_id,
      location_id = 1,
      type,
      qty,
      ref_type,
      ref_id,
      notes,
      created_by,
    } = data;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Buscar saldo atual
      const [balanceRows] = await connection.query(
        "SELECT qty_on_hand, qty_reserved FROM stock_balances WHERE product_id = ? AND location_id = ?",
        [product_id, location_id]
      );

      const currentBalance = balanceRows[0] || {
        qty_on_hand: 0,
        qty_reserved: 0,
      };
      const qtyBefore = currentBalance.qty_on_hand;

      let qtyAfter = qtyBefore;

      // Atualizar saldo conforme tipo
      if (type === "ENTRY" || type === "ADJUSTMENT") {
        qtyAfter = qtyBefore + qty;
        await connection.query(
          `INSERT INTO stock_balances (product_id, location_id, qty_on_hand, qty_reserved)
           VALUES (?, ?, ?, 0)
           ON DUPLICATE KEY UPDATE qty_on_hand = qty_on_hand + ?`,
          [product_id, location_id, qty, qty]
        );
      } else if (type === "EXIT") {
        qtyAfter = qtyBefore - qty;
        await connection.query(
          `UPDATE stock_balances 
           SET qty_on_hand = qty_on_hand - ?
           WHERE product_id = ? AND location_id = ?`,
          [qty, product_id, location_id]
        );
      }

      // Registrar movimentação
      const [result] = await connection.query(
        `INSERT INTO stock_movements 
         (product_id, location_id, type, qty, qty_before, qty_after, ref_type, ref_id, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product_id,
          location_id,
          type,
          qty,
          qtyBefore,
          qtyAfter,
          ref_type || null,
          ref_id || null,
          notes || null,
          created_by || null,
        ]
      );

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Verifica disponibilidade de produto
   */
  static async checkAvailability(productId, qty, locationId = 1) {
    const [rows] = await db.query(
      `SELECT qty_on_hand, qty_reserved, (qty_on_hand - qty_reserved) AS qty_available
       FROM stock_balances
       WHERE product_id = ? AND location_id = ?`,
      [productId, locationId]
    );

    const balance = rows[0] || { qty_on_hand: 0, qty_reserved: 0, qty_available: 0 };
    return {
      available: balance.qty_available >= qty,
      qtyAvailable: balance.qty_available,
      qtyOnHand: balance.qty_on_hand,
      qtyReserved: balance.qty_reserved,
    };
  }
}
