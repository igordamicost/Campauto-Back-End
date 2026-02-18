import express from "express";
import notificationsController from "../controllers/notificationsController.js";
import { authMiddleware } from "../src/middlewares/auth.js";

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar notificações do usuário logado
router.get("/", notificationsController.listNotifications);

// Marcar notificação como lida
router.post("/:id/read", notificationsController.markAsRead);

export default router;
