import { db } from "../config/database.js";

/**
 * Repositório para operações de Reservas
 */
export class ReservationRepository {
  /**
   * Cria uma nova reserva
   */
  static async create(data) {
    const {
      product_id,
      customer_id,
      salesperson_user_id,
      location_id = 1,
      qty,
      due_at,
      notes,
      created_by,
    } = data;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Criar reserva
      const [result] = await connection.query(
        `INSERT INTO reservations 
         (product_id, customer_id, salesperson_user_id, location_id, qty, status, due_at, notes, created_by)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
        [
          product_id,
          customer_id,
          salesperson_user_id,
          location_id,
          qty,
          due_at,
          notes || null,
          created_by || null,
        ]
      );

      const reservationId = result.insertId;

      // Atualizar saldo de estoque (aumentar qty_reserved)
      await connection.query(
        `INSERT INTO stock_balances (product_id, location_id, qty_on_hand, qty_reserved)
         VALUES (?, ?, 0, ?)
         ON DUPLICATE KEY UPDATE qty_reserved = qty_reserved + ?`,
        [product_id, location_id, qty, qty]
      );

      // Registrar movimentação
      await connection.query(
        `INSERT INTO stock_movements 
         (product_id, location_id, type, qty, ref_type, ref_id, created_by)
         VALUES (?, ?, 'RESERVE', ?, 'RESERVATION', ?, ?)`,
        [product_id, location_id, qty, reservationId, created_by || null]
      );

      // Registrar evento
      await connection.query(
        `INSERT INTO reservation_events 
         (reservation_id, event_type, notes, created_by)
         VALUES (?, 'CREATED', ?, ?)`,
        [reservationId, notes || null, created_by || null]
      );

      await connection.commit();
      return reservationId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Busca reserva por ID
   */
  static async getById(id) {
    const [rows] = await db.query(
      `SELECT r.*,
              p.id AS product_id, p.descricao AS product_name, p.codigo AS product_code,
              c.id AS customer_id, c.cliente AS customer_name,
              u.id AS salesperson_id, u.name AS salesperson_name, u.email AS salesperson_email
       FROM reservations r
       LEFT JOIN produtos p ON r.product_id = p.id
       LEFT JOIN clientes c ON r.customer_id = c.id
       LEFT JOIN users u ON r.salesperson_user_id = u.id
       WHERE r.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Lista reservas com filtros
   */
  static async list(filters = {}) {
    const {
      status,
      dueFrom,
      dueTo,
      customerId,
      productId,
      salespersonId,
      limit = 50,
      offset = 0,
    } = filters;

    const whereParts = [];
    const params = [];

    if (status) {
      whereParts.push("r.status = ?");
      params.push(status);
    }

    if (dueFrom) {
      whereParts.push("r.due_at >= ?");
      params.push(dueFrom);
    }

    if (dueTo) {
      whereParts.push("r.due_at <= ?");
      params.push(dueTo);
    }

    if (customerId) {
      whereParts.push("r.customer_id = ?");
      params.push(customerId);
    }

    if (productId) {
      whereParts.push("r.product_id = ?");
      params.push(productId);
    }

    if (salespersonId) {
      whereParts.push("r.salesperson_user_id = ?");
      params.push(salespersonId);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT r.*,
              p.descricao AS product_name, p.codigo AS product_code,
              c.cliente AS customer_name,
              u.name AS salesperson_name
       FROM reservations r
       LEFT JOIN produtos p ON r.product_id = p.id
       LEFT JOIN clientes c ON r.customer_id = c.id
       LEFT JOIN users u ON r.salesperson_user_id = u.id
       ${whereSql}
       ORDER BY r.due_at ASC, r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM reservations r ${whereSql}`,
      params
    );

    return { data: rows, total: countRow.total };
  }

  /**
   * Atualiza reserva
   */
  static async update(id, data) {
    const { due_at, notes, status } = data;
    const updates = [];
    const params = [];

    if (due_at !== undefined) {
      updates.push("due_at = ?");
      params.push(due_at);
    }

    if (notes !== undefined) {
      updates.push("notes = ?");
      params.push(notes);
    }

    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }

    if (updates.length === 0) return false;

    params.push(id);

    const [result] = await db.query(
      `UPDATE reservations SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  /**
   * Retorna reserva (devolução)
   */
  static async returnReservation(id, userId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Buscar reserva
      const [resRows] = await connection.query(
        "SELECT * FROM reservations WHERE id = ? AND status IN ('ACTIVE', 'DUE_SOON', 'OVERDUE')",
        [id]
      );

      if (resRows.length === 0) {
        throw new Error("Reserva não encontrada ou já finalizada");
      }

      const reservation = resRows[0];

      // Atualizar status
      await connection.query(
        "UPDATE reservations SET status = 'RETURNED', returned_at = NOW() WHERE id = ?",
        [id]
      );

      // Liberar estoque (reduzir qty_reserved)
      await connection.query(
        `UPDATE stock_balances 
         SET qty_reserved = qty_reserved - ?
         WHERE product_id = ? AND location_id = ?`,
        [reservation.qty, reservation.product_id, reservation.location_id]
      );

      // Registrar movimentação
      await connection.query(
        `INSERT INTO stock_movements 
         (product_id, location_id, type, qty, ref_type, ref_id, created_by)
         VALUES (?, ?, 'RESERVE_RETURN', ?, 'RESERVATION', ?, ?)`,
        [
          reservation.product_id,
          reservation.location_id,
          reservation.qty,
          id,
          userId,
        ]
      );

      // Registrar evento
      await connection.query(
        `INSERT INTO reservation_events 
         (reservation_id, event_type, old_status, new_status, created_by)
         VALUES (?, 'RETURNED', ?, 'RETURNED', ?)`,
        [id, reservation.status, userId]
      );

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
   * Cancela reserva
   */
  static async cancelReservation(id, userId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [resRows] = await connection.query(
        "SELECT * FROM reservations WHERE id = ? AND status IN ('ACTIVE', 'DUE_SOON', 'OVERDUE')",
        [id]
      );

      if (resRows.length === 0) {
        throw new Error("Reserva não encontrada ou já finalizada");
      }

      const reservation = resRows[0];

      await connection.query(
        "UPDATE reservations SET status = 'CANCELED' WHERE id = ?",
        [id]
      );

      // Liberar estoque
      await connection.query(
        `UPDATE stock_balances 
         SET qty_reserved = qty_reserved - ?
         WHERE product_id = ? AND location_id = ?`,
        [reservation.qty, reservation.product_id, reservation.location_id]
      );

      // Registrar movimentação
      await connection.query(
        `INSERT INTO stock_movements 
         (product_id, location_id, type, qty, ref_type, ref_id, created_by)
         VALUES (?, ?, 'RESERVE_RETURN', ?, 'RESERVATION', ?, ?)`,
        [
          reservation.product_id,
          reservation.location_id,
          reservation.qty,
          id,
          userId,
        ]
      );

      // Registrar evento
      await connection.query(
        `INSERT INTO reservation_events 
         (reservation_id, event_type, old_status, new_status, created_by)
         VALUES (?, 'CANCELED', ?, 'CANCELED', ?)`,
        [id, reservation.status, userId]
      );

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
   * Busca reservas que precisam de atualização de status (para scheduler)
   */
  static async getReservationsForStatusUpdate(dueSoonHours = 24) {
    const [rows] = await db.query(
      `SELECT id, product_id, salesperson_user_id, due_at, status
       FROM reservations
       WHERE status IN ('ACTIVE', 'DUE_SOON')
         AND due_at <= DATE_ADD(NOW(), INTERVAL ? HOUR)
       ORDER BY due_at ASC`,
      [dueSoonHours]
    );
    return rows;
  }
}
