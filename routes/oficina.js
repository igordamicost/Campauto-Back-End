import express from "express";
import * as controller from "../controllers/oficinaController.js";
import { authMiddleware } from "../src/middlewares/auth.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authMiddleware);

// OS
router.get("/os", asyncHandler(controller.listOS));
router.get("/os/:id", asyncHandler(controller.getOSById));
router.post("/os", asyncHandler(controller.createOS));
router.put("/os/:id", asyncHandler(controller.updateOS));
router.delete("/os/:id", asyncHandler(controller.removeOS));
router.patch("/os/:id/status", asyncHandler(controller.updateStatus));
router.post("/os/:id/finalizar", asyncHandler(controller.finalizarOS));

// Checklists
router.get("/os/:osId/checklists", asyncHandler(controller.getChecklists));
router.post("/os/:osId/checklists", asyncHandler(controller.createChecklist));
router.put("/os/:osId/checklists/:checklistId", asyncHandler(controller.updateChecklist));
router.delete("/os/:osId/checklists/:checklistId", asyncHandler(controller.removeChecklist));
router.patch("/os/:osId/checklists/:checklistId/concluir", asyncHandler(controller.concluirChecklist));

export default router;
