import express from "express";
import stockController from "../controllers/stockController.js";
import * as comprasController from "../controllers/comprasController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { requirePermission } from "../src/middlewares/permissions.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Saldos e movimentações (por empresa_id; lojas = GET /empresas)
router.get("/balances", requirePermission("stock.read"), stockController.listBalances);
router.get("/movements", requirePermission("stock.read"), stockController.listMovements);
router.get("/availability/:productId", requirePermission("stock.read"), stockController.checkAvailability);

// Entrada de estoque (manual e por código de barras)
router.post("/entries", requirePermission("stock.move"), stockController.createEntry);
router.get("/products/by-barcode", requirePermission("stock.read"), stockController.getByBarcode);

// Importar XML (pedido fábrica) - body: { empresa_id, xml } ou multipart file + empresa_id
router.post("/import-xml", requirePermission("stock.move"), stockController.importXml);

// Criar movimentação genérica (requer permissão de movimentação)
router.post("/movements", requirePermission("stock.move"), stockController.createMovement);

// Rotas de Compras
router.get("/compras", asyncHandler(comprasController.list));
router.get("/compras/:id", asyncHandler(comprasController.getById));
router.post("/compras", asyncHandler(comprasController.create));
router.put("/compras/:id", asyncHandler(comprasController.update));
router.delete("/compras/:id", asyncHandler(comprasController.remove));
router.patch("/compras/:id/finalizar", asyncHandler(comprasController.finalizar));

export default router;
