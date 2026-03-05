import express from "express";
import multer from "multer";
import reservationsController from "../controllers/reservationsController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { requirePermission } from "../src/middlewares/permissions.js";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar e buscar reservas (requer permissão de leitura)
router.get("/", requirePermission("stock.read"), reservationsController.listReservations);
router.get("/:id", requirePermission("stock.read"), reservationsController.getReservationById);

// Criar reserva (requer permissão específica)
router.post("/", requirePermission("stock.reserve.create"), reservationsController.createReservation);

// Atualizar reserva (requer permissão específica)
router.put("/:id", requirePermission("stock.reserve.update"), reservationsController.updateReservation);

// Devolver reserva
router.post("/:id/return", requirePermission("stock.reserve.update"), reservationsController.returnReservation);

// Cancelar reserva
router.post("/:id/cancel", requirePermission("stock.reserve.cancel"), reservationsController.cancelReservation);

// Enviar documento/termo por e-mail
router.post("/:id/send-document", upload.single("file"), requirePermission("stock.reserve.update"), reservationsController.sendDocument);

// Upload de documento assinado
router.post("/:id/upload-document", upload.single("file"), requirePermission("stock.reserve.update"), reservationsController.uploadDocument);

export default router;
