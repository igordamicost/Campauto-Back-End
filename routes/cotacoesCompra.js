import express from "express";
import * as controller from "../controllers/cotacoesCompraController.js";
import { authMiddleware } from "../src/middlewares/auth.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authMiddleware);

router.get("/ultima", asyncHandler(controller.getUltima));
router.post("/ultimas", asyncHandler(controller.getUltimas));
router.post("/", asyncHandler(controller.create));

export default router;
