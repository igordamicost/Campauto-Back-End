import express from "express";
import { login, getMe, refresh, logout, keepAlive } from "../controllers/authController.js";
import { forgotPassword, setPassword, resetPassword } from "../src/controllers/auth.controller.js";
import { forgotPasswordLimiter } from "../src/middlewares/rateLimitForgotPassword.js";
import { authMiddleware, optionalAuthMiddleware } from "../src/middlewares/auth.js";
import { csrfAuthMiddleware } from "../src/middlewares/csrfAuth.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.post("/login", asyncHandler(login));
router.get("/me", authMiddleware, asyncHandler(getMe));
router.get("/keep-alive", authMiddleware, asyncHandler(keepAlive));
router.post("/refresh", csrfAuthMiddleware, asyncHandler(refresh));
router.post("/logout", csrfAuthMiddleware, optionalAuthMiddleware, asyncHandler(logout));
router.post("/forgot-password", forgotPasswordLimiter, asyncHandler(forgotPassword));
router.post("/reset-password", asyncHandler(resetPassword));
router.post("/set-password", asyncHandler(setPassword));

export default router;
