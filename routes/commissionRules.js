import express from "express";
import commissionRulesController from "../controllers/commissionRulesController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { masterOnly } from "../src/middlewares/masterOnly.js";

const router = express.Router();

// Todas as rotas requerem autenticação e permissão MASTER
router.use(authMiddleware);
router.use(masterOnly);

router.get("/", commissionRulesController.listRules);
router.get("/:id", commissionRulesController.getRuleById);
router.post("/", commissionRulesController.createRule);
router.put("/:id", commissionRulesController.updateRule);
router.delete("/:id", commissionRulesController.deleteRule);

export default router;
