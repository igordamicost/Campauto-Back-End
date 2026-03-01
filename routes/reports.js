import express from "express";
import reportsController from "../controllers/reportsController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { requirePermission } from "../src/middlewares/permissions.js";

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Meu Desempenho - rotas mais específicas primeiro
router.get("/my-sales/metrics", requirePermission("reports.my_sales.read"), reportsController.getMySalesMetrics);
router.get("/my-sales/evolucao", requirePermission("reports.my_sales.read"), reportsController.getMySalesEvolucao);
router.get("/my-sales", requirePermission("reports.my_sales.read"), reportsController.getMySales);

export default router;
