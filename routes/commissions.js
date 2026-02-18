import express from "express";
import reportsController from "../controllers/reportsController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { requirePermission } from "../src/middlewares/permissions.js";

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Comissões do próprio usuário
router.get("/", requirePermission("commissions.read"), reportsController.getMyCommissions);

// Comissões por vendedor (admin)
router.get("/by-salesperson", requirePermission("commissions.read"), reportsController.getCommissionsBySalesperson);

export default router;
