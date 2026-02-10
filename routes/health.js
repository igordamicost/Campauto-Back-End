import express from "express";
import { transporter } from "../src/config/email.js";

const router = express.Router();

/**
 * @swagger
 * /health/email:
 *   get:
 *     summary: Envia email de teste
 *     responses:
 *       200:
 *         description: Email enviado
 */
router.get("/email", async (req, res) => {
  try {
    await transporter.sendMail({
      from: `JR Carpeças <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: "Teste de email",
      text: "Email de teste"
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || String(error)
    });
  }
});

router.get("/", (req, res) => {
  res.json({ status: "ok" });
});

export default router;
