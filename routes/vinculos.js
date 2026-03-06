import express from "express";
import {
  listProdutoVinculos,
  createProdutoVinculo,
  deleteProdutoVinculo,
  getSimilares,
  listFabricas,
  getFabricaById,
  createFabrica,
  updateFabrica,
  deleteFabrica,
  getFabricaProdutos,
  vincularProdutos,
  desvincularProduto,
  listKits,
  createKit,
  updateKit,
  deleteKit,
  getKitProdutos,
  asyncHandler,
} from "../controllers/vinculosController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { requirePermission } from "../src/middlewares/permissions.js";

const router = express.Router();

router.use(authMiddleware);

// --- Vínculos de Produtos ---
router.get("/produtos", requirePermission("vinculos.read"), asyncHandler(listProdutoVinculos));
router.post("/produtos", requirePermission("vinculos.create"), asyncHandler(createProdutoVinculo));
router.delete("/produtos/:id", requirePermission("vinculos.delete"), asyncHandler(deleteProdutoVinculo));
router.get("/produtos/:produtoId/similares", requirePermission("vinculos.read"), asyncHandler(getSimilares));

// --- Fábricas ---
router.get("/fabricas", requirePermission("vinculos.read"), asyncHandler(listFabricas));
router.get("/fabricas/:id", requirePermission("vinculos.read"), asyncHandler(getFabricaById));
router.post("/fabricas", requirePermission("vinculos.create"), asyncHandler(createFabrica));
router.put("/fabricas/:id", requirePermission("vinculos.update"), asyncHandler(updateFabrica));
router.delete("/fabricas/:id", requirePermission("vinculos.delete"), asyncHandler(deleteFabrica));
router.get("/fabricas/:id/produtos", requirePermission("vinculos.read"), asyncHandler(getFabricaProdutos));
router.post("/fabricas/:id/produtos", requirePermission("vinculos.create"), asyncHandler(vincularProdutos));
router.delete("/fabricas/:id/produtos/:produtoId", requirePermission("vinculos.delete"), asyncHandler(desvincularProduto));

// --- Kits ---
router.get("/kits", requirePermission("vinculos.read"), asyncHandler(listKits));
router.post("/kits", requirePermission("vinculos.create"), asyncHandler(createKit));
router.get("/kits/:id/produtos", requirePermission("vinculos.read"), asyncHandler(getKitProdutos));
router.put("/kits/:id", requirePermission("vinculos.update"), asyncHandler(updateKit));
router.delete("/kits/:id", requirePermission("vinculos.delete"), asyncHandler(deleteKit));

export default router;
