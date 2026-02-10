import express from "express";
import { login } from "../controllers/authController.js";
import { forgotPassword, resetPassword } from "../src/controllers/auth.controller.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token JWT
 *       401:
 *         description: Credenciais inválidas
 */
router.post('/login', asyncHandler(login));

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Envia email de recuperação
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: cliente@gmail.com
 *     responses:
 *       200:
 *         description: Se o email existir, você receberá instruções
 */
router.post('/forgot-password', asyncHandler(forgotPassword));

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Redefine senha com token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Senha alterada com sucesso
 */
router.post('/reset-password', asyncHandler(resetPassword));

export default router;
