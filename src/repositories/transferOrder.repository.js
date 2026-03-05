import { db } from "../config/database.js";

/**
 * Repositório para Pedidos de Movimentação (Transfer Orders)
 */
export class TransferOrderRepository {
  static async list(filters = {}) {
    const {
      page = 1,
      limit = 20,
      q,
      status,
      orcamento_id,
      empresa_origem_id,
      empresa_destino_id,
    } = filters;

    const whereParts = [];
    const params = [];

    if (status) {
      whereParts.push("tro.status = ?");
      params.push(status);
    }
    if (orcamento_id) {
      whereParts.push("tro.orcamento_id = ?");
      params.push(Number(orcamento_id));
    }
    if (empresa_origem_id) {
      whereParts.push("tro.empresa_origem_id = ?");
      params.push(Number(empresa_origem_id));
    }
    if (empresa_destino_id) {
      whereParts.push("tro.empresa_destino_id = ?");
      params.push(Number(empresa_destino_id));
    }
    if (q && String(q).trim()) {
      whereParts.push("(o.numero_sequencial = ? OR eo.nome_fantasia LIKE ? OR ed.nome_fantasia LIKE ?)");
      const term = `%${String(q).trim()}%`;
      params.push(Number(q) || 0, term, term);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const offset = (Math.max(1, Number(page)) - 1) * Math.min(100, Number(limit) || 20);
    const limitNum = Math.min(100, Number(limit) || 20);

    const [rows] = await db.query(
      `SELECT tro.id, tro.orcamento_id, tro.empresa_origem_id, tro.empresa_destino_id, tro.status,
              tro.created_at, tro.updated_at,
              o.numero_sequencial AS orcamento_numero,
              eo.nome_fantasia AS empresa_origem_nome,
              ed.nome_fantasia AS empresa_destino_nome
       FROM transfer_orders tro
       LEFT JOIN orcamentos o ON tro.orcamento_id = o.id
       LEFT JOIN empresas eo ON tro.empresa_origem_id = eo.id
       LEFT JOIN empresas ed ON tro.empresa_destino_id = ed.id
       ${whereSql}
       ORDER BY tro.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM transfer_orders tro
       LEFT JOIN orcamentos o ON tro.orcamento_id = o.id
       LEFT JOIN empresas eo ON tro.empresa_origem_id = eo.id
       LEFT JOIN empresas ed ON tro.empresa_destino_id = ed.id
       ${whereSql}`,
      params
    );

    return { data: rows, total: countRow?.total ?? 0 };
  }

  static async getById(id) {
    const [[order]] = await db.query(
      `SELECT tro.*,
              o.numero_sequencial AS orcamento_numero,
              eo.nome_fantasia AS empresa_origem_nome,
              ed.nome_fantasia AS empresa_destino_nome
       FROM transfer_orders tro
       LEFT JOIN orcamentos o ON tro.orcamento_id = o.id
       LEFT JOIN empresas eo ON tro.empresa_origem_id = eo.id
       LEFT JOIN empresas ed ON tro.empresa_destino_id = ed.id
       WHERE tro.id = ?`,
      [id]
    );
    if (!order) return null;

    const [items] = await db.query(
      `SELECT toi.id, toi.product_id, toi.quantity,
              p.descricao AS product_name, p.codigo_produto AS product_code
       FROM transfer_order_items toi
       LEFT JOIN produtos p ON toi.product_id = p.id
       WHERE toi.transfer_order_id = ?`,
      [id]
    );
    order.items = items;
    return order;
  }

  static async create(data) {
    const { orcamento_id, empresa_origem_id, empresa_destino_id, items } = data;
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        `INSERT INTO transfer_orders (orcamento_id, empresa_origem_id, empresa_destino_id, status)
         VALUES (?, ?, ?, 'draft')`,
        [orcamento_id || null, empresa_origem_id, empresa_destino_id]
      );
      const orderId = result.insertId;
      if (items && Array.isArray(items) && items.length > 0) {
        for (const it of items) {
          await connection.query(
            `INSERT INTO transfer_order_items (transfer_order_id, product_id, quantity)
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
    const validStatus = ["draft", "requested", "nf_issued", "in_transit", "received", "canceled"];
    if (!validStatus.includes(status)) return false;

    if (status === "received") {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [orderRows] = await connection.query(
          "SELECT empresa_origem_id, empresa_destino_id FROM transfer_orders WHERE id = ?",
          [id]
        );
        const order = orderRows[0];
        if (!order) {
          await connection.rollback();
          return false;
        }

        const [items] = await connection.query(
          "SELECT product_id, quantity FROM transfer_order_items WHERE transfer_order_id = ?",
          [id]
        );

        for (const it of items) {
          const { product_id, quantity } = it;
          const qty = Number(quantity);

          const [origRows] = await connection.query(
            "SELECT qty_on_hand FROM stock_items WHERE product_id = ? AND empresa_id = ?",
            [product_id, order.empresa_origem_id]
          );
          const qtyBeforeOrig = origRows[0]?.qty_on_hand ?? 0;
          const qtyAfterOrig = qtyBeforeOrig - qty;

          await connection.query(
            "UPDATE stock_items SET qty_on_hand = qty_on_hand - ? WHERE product_id = ? AND empresa_id = ?",
            [qty, product_id, order.empresa_origem_id]
          );
          await connection.query(
            `INSERT INTO stock_movements (product_id, empresa_id, type, qty, qty_before, qty_after, ref_type, ref_id, created_by)
             VALUES (?, ?, 'transferencia_saida', ?, ?, ?, 'TRANSFER_ORDER', ?, NULL)`,
            [product_id, order.empresa_origem_id, qty, qtyBeforeOrig, qtyAfterOrig, id]
          );

          const [destRows] = await connection.query(
            "SELECT qty_on_hand FROM stock_items WHERE product_id = ? AND empresa_id = ?",
            [product_id, order.empresa_destino_id]
          );
          const qtyBeforeDest = destRows[0]?.qty_on_hand ?? 0;
          const qtyAfterDest = qtyBeforeDest + qty;

          await connection.query(
            `INSERT INTO stock_items (product_id, empresa_id, qty_on_hand, qty_reserved, qty_in_budget)
             VALUES (?, ?, ?, 0, 0)
             ON DUPLICATE KEY UPDATE qty_on_hand = qty_on_hand + ?`,
            [product_id, order.empresa_destino_id, qty, qty]
          );
          await connection.query(
            `INSERT INTO stock_movements (product_id, empresa_id, type, qty, qty_before, qty_after, ref_type, ref_id, created_by)
             VALUES (?, ?, 'transferencia_entrada', ?, ?, ?, 'TRANSFER_ORDER', ?, NULL)`,
            [product_id, order.empresa_destino_id, qty, qtyBeforeDest, qtyAfterDest, id]
          );
        }

        await connection.query(
          "UPDATE transfer_orders SET status = 'received', updated_at = NOW() WHERE id = ?",
          [id]
        );
        await connection.commit();
        return true;
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    const [result] = await db.query(
      "UPDATE transfer_orders SET status = ?, updated_at = NOW() WHERE id = ?",
      [status, id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Verifica se já existe transfer_order para orcamento+empresa_origem+empresa_destino+produto
   */
  static async findExistingForOrcamentoItem(orcamentoId, empresaOrigemId, empresaDestinoId, productId) {
    const [rows] = await db.query(
      `SELECT tro.id FROM transfer_orders tro
       INNER JOIN transfer_order_items toi ON toi.transfer_order_id = tro.id
       WHERE tro.orcamento_id = ? AND tro.empresa_origem_id = ? AND tro.empresa_destino_id = ?
         AND toi.product_id = ? AND tro.status NOT IN ('canceled', 'received')
       LIMIT 1`,
      [orcamentoId, empresaOrigemId, empresaDestinoId, productId]
    );
    return rows[0]?.id || null;
  }
}
