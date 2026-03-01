import express from "express";
import multer from "multer";
import * as controller from "../controllers/pedidosCompraController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { requirePermission } from "../src/middlewares/permissions.js";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authMiddleware);

router.get("/", requirePermission("stock.read"), asyncHandler(controller.list));
router.get("/:id", requirePermission("stock.read"), asyncHandler(controller.getById));
router.post("/", requirePermission("stock.move"), asyncHandler(controller.create));
router.put("/:id", requirePermission("stock.move"), asyncHandler(controller.update));
router.patch("/:id/status", requirePermission("stock.move"), asyncHandler(controller.updateStatus));
router.delete("/:id", requirePermission("stock.move"), asyncHandler(controller.remove));
router.post(
  "/:id/enviar-fornecedores",
  requirePermission("stock.move"),
  upload.single("file"),
  asyncHandler(controller.enviarFornecedores)
);

export default router;
