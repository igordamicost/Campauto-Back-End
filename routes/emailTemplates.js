import express from "express";
import * as controller from "../controllers/emailTemplatesController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { masterOnly } from "../src/middlewares/masterOnly.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authMiddleware);
router.use(masterOnly);

router.get("/", asyncHandler(controller.list));
router.put("/:templateKey", asyncHandler(controller.update));
router.post("/:templateKey/preview", asyncHandler(controller.preview));
router.post("/:templateKey/test", asyncHandler(controller.testTemplate));

export default router;
