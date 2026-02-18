import { NotificationRepository } from "../src/repositories/notification.repository.js";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Lista notificações do usuário logado
 */
async function listNotifications(req, res) {
  try {
    const userId = req.user.userId;
    const { isRead, limit = 50, offset = 0 } = req.query;

    const filters = {
      isRead: isRead !== undefined ? isRead === "true" : undefined,
      limit: Math.max(1, Math.min(1000, parseInt(limit) || 50)),
      offset: Math.max(0, parseInt(offset) || 0),
    };

    const result = await NotificationRepository.getUserNotifications(userId, filters);

    return res.json(result);
  } catch (error) {
    console.error("Error listing notifications:", error);
    return res.status(500).json({ message: "Erro ao listar notificações" });
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
