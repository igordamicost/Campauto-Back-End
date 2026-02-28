import express from "express";
import * as controller from "../controllers/orcamentosController.js";
import { authMiddleware } from "../src/middlewares/auth.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authMiddleware);

router.get("/", asyncHandler(controller.list));
router.get("/:id", asyncHandler(controller.getById));
router.post("/", asyncHandler(controller.create));
router.put("/:id", asyncHandler(controller.update));
router.patch("/:id/status", asyncHandler(controller.updateStatus));
router.delete("/:id", asyncHandler(controller.remove));
router.post("/:id/enviar-email", asyncHandler(controller.sendEmail));

export default router;
