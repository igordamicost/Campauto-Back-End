import express from "express";
import preOrdersController from "../controllers/preOrdersController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { requirePermission } from "../src/middlewares/permissions.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", requirePermission("stock.read"), preOrdersController.list);
router.get("/:id", requirePermission("stock.read"), preOrdersController.getById);
router.post("/", requirePermission("stock.move"), preOrdersController.create);
router.patch("/:id/approve", requirePermission("admin.read"), preOrdersController.approve);
router.patch("/:id/status", requirePermission("stock.move"), preOrdersController.updateStatus);

export default router;
