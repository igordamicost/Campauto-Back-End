import express from "express";
import * as controller from "../controllers/oficinaController.js";
import { authMiddleware } from "../src/middlewares/auth.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authMiddleware);

router.get("/os", asyncHandler(controller.listOS));
router.get("/os/:id", asyncHandler(controller.getOSById));
router.get("/os/:osId/checklists", asyncHandler(controller.getChecklists));

export default router;
