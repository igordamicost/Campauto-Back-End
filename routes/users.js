import express from "express";
import * as controller from "../controllers/usersController.js";
import { authMiddleware } from "../src/middlewares/auth.js";
import { masterOnly } from "../src/middlewares/masterOnly.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authMiddleware);

router.get("/", asyncHandler(controller.list));
router.post("/", masterOnly, asyncHandler(controller.createUser));
router.get("/:id", asyncHandler(controller.getById));
router.patch("/:id/block", asyncHandler(controller.blockUser));
router.post("/:id/reset-password", asyncHandler(controller.resetPasswordUser));
router.put("/:id", asyncHandler(controller.updateUser));
router.delete("/:id", asyncHandler(controller.removeUser));

export default router;
