import express from "express";
import * as controller from "../controllers/integrationsController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { masterOnly } from "../src/middlewares/masterOnly.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authMiddleware);
router.use(masterOnly);

router.post("/google-mail", asyncHandler(controller.configGoogleMail));
router.post("/google-mail/test", asyncHandler(controller.testGoogleMail));
router.post("/google-mail/exchange-code", asyncHandler(controller.exchangeCode));

export default router;
