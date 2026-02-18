import express from "express";
import stockController from "../controllers/stockController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { requirePermission } from "../src/middlewares/permissions.js";

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar saldos e movimentações (requer permissão de leitura)
router.get("/balances", requirePermission("stock.read"), stockController.listBalances);
router.get("/movements", requirePermission("stock.read"), stockController.listMovements);
router.get("/availability/:productId", requirePermission("stock.read"), stockController.checkAvailability);

// Criar movimentação (requer permissão de movimentação)
router.post("/movements", requirePermission("stock.move"), stockController.createMovement);

export default router;
