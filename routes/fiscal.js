import express from "express";
import * as controller from "../controllers/fiscalController.js";
import { authMiddleware } from "../src/middlewares/auth.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authMiddleware);

router.get("/exportacoes", asyncHandler(controller.listExportacoes));

export default router;
