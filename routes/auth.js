import express from "express";
import { login, getMe } from "../controllers/authController.js";
import { forgotPassword, setPassword } from "../src/controllers/auth.controller.js";
import { forgotPasswordLimiter } from "../src/middlewares/rateLimitForgotPassword.js";
import { authMiddleware } from "../src/middlewares/auth.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.post("/login", asyncHandler(login));
router.get("/me", authMiddleware, asyncHandler(getMe));
router.post("/forgot-password", forgotPasswordLimiter, asyncHandler(forgotPassword));
router.post("/set-password", asyncHandler(setPassword));

export default router;
