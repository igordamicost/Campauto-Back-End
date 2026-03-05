import express from "express";
import salesLogController from "../controllers/salesLogController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { requirePermission } from "../src/middlewares/permissions.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", requirePermission("sales.read"), salesLogController.list);

export default router;
