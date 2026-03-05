import express from "express";
import transferOrdersController from "../controllers/transferOrdersController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { requirePermission } from "../src/middlewares/permissions.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", requirePermission("stock.read"), transferOrdersController.list);
router.get("/:id", requirePermission("stock.read"), transferOrdersController.getById);
router.post("/", requirePermission("stock.move"), transferOrdersController.create);
router.patch("/:id/status", requirePermission("stock.move"), transferOrdersController.updateStatus);

export default router;
