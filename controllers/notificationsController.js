import { NotificationRepository } from "../src/repositories/notification.repository.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function mapNotificationToResponse(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: Boolean(row.is_read),
    readAt: row.read_at || null,
    createdAt: row.created_at,
    metadata: row.metadata,
  };
}

/**
 * Lista notificações do usuário logado
 * Query: isRead (boolean), limit, offset
 */
async function listNotifications(req, res) {
  try {
    const userId = req.user?.userId ?? req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    const { isRead, limit = 50, offset = 0 } = req.query;

    const filters = {
      isRead: isRead !== undefined ? isRead === "true" : undefined,
      limit: Math.max(1, Math.min(1000, parseInt(limit, 10) || 50)),
      offset: Math.max(0, parseInt(offset, 10) || 0),
    };

    const result = await NotificationRepository.getUserNotifications(userId, filters);

    return res.json({
      data: (result.data || []).map(mapNotificationToResponse),
      total: result.total ?? 0,
    });
  } catch (error) {
    console.error("Error listing notifications:", error?.message || error);
    return res.status(500).json({
      message: "Erro ao listar notificações",
      ...(process.env.NODE_ENV === "development" && { detail: error?.message }),
    });
  }
}

/**
 * Marca notificação como lida
 */
async function markAsRead(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const updated = await NotificationRepository.markAsRead(id, userId);

    if (!updated) {
      return res.status(404).json({ message: "Notificação não encontrada" });
    }

    return res.json({ message: "Notificação marcada como lida" });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({ message: "Erro ao marcar notificação como lida" });
  }
}

export default {
  listNotifications: asyncHandler(listNotifications),
  markAsRead: asyncHandler(markAsRead),
};
