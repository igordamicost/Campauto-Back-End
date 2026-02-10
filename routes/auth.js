import express from "express";
import { login } from "../controllers/authController.js";
import { forgotPassword, resetPassword } from "../src/controllers/auth.controller.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.post('/login', asyncHandler(login));

router.post('/forgot-password', asyncHandler(forgotPassword));

router.post('/reset-password', asyncHandler(resetPassword));

export default router;
