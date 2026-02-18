import { db } from "../config/database.js";

/**
 * Repositório para operações de Notificações
 */
export class NotificationRepository {
  /**
   * Cria notificação
   */
  static async create(data) {
    const { user_id, type, title, message, metadata } = data;

    const [result] = await db.query(
      `INSERT INTO notifications (user_id, type, title, message, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, type, title, message, metadata ? JSON.stringify(metadata) : null]
    );

    return result.insertId;
  }

  /**
   * Busca notificações de um usuário
   */
  static async getUserNotifications(userId, filters = {}) {
    const { isRead, limit = 50, offset = 0 } = filters;
    const whereParts = ["user_id = ?"];
    const params = [userId];

    if (isRead !== undefined) {
      whereParts.push("is_read = ?");
      params.push(isRead ? 1 : 0);
    }

    const whereSql = `WHERE ${whereParts.join(" AND ")}`;

    const [rows] = await db.query(
      `SELECT id, type, title, message, is_read, read_at, metadata, created_at
       FROM notifications
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM notifications ${whereSql}`,
      params
    );

    return {
      data: rows.map((row) => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
      })),
      total: countRow.total,
    };
  }

  /**
   * Marca notificação como lida
   */
  static async markAsRead(notificationId, userId) {
    const [result] = await db.query(
      `UPDATE notifications 
       SET is_read = 1, read_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );

    return result.affectedRows > 0;
  }

  /**
   * Verifica se notificação já foi enviada hoje (evitar duplicatas)
   */
  static async wasNotificationSentToday(reservationId, userId, notificationType) {
    const today = new Date().toISOString().split("T")[0];
    const [rows] = await db.query(
      `SELECT COUNT(*) AS count
       FROM notification_sent_log
       WHERE reservation_id = ? AND user_id = ? AND notification_type = ? AND sent_date = ?`,
      [reservationId, userId, notificationType, today]
    );

    return rows[0].count > 0;
  }

  /**
   * Registra envio de notificação (para controle de duplicatas)
   */
  static async logNotificationSent(reservationId, userId, notificationType) {
    const today = new Date().toISOString().split("T")[0];
    await db.query(
      `INSERT IGNORE INTO notification_sent_log (reservation_id, user_id, notification_type, sent_date)
       VALUES (?, ?, ?, ?)`,
      [reservationId, userId, notificationType, today]
    );
  }

  /**
   * Busca gerentes (ADMIN ou MASTER)
   */
  static async getManagers() {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email
       FROM users u
       INNER JOIN roles r ON u.role_id = r.id
       WHERE r.name IN ('ADMIN', 'MASTER')
       ORDER BY r.name, u.name`
    );
    return rows;
  }
}
