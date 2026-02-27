import express from "express";
import { transporter } from "../src/config/email.js";
import { DEFAULT_FROM } from "../src/config/mail.js";

const router = express.Router();

router.get("/email", async (req, res) => {
  try {
    await transporter.sendMail({
      from: DEFAULT_FROM || process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: "Teste de email",
      text: "Email de teste",
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || String(error),
    });
  }
});

router.get("/", (req, res) => {
  res.json({ status: "ok" });
});

export default router;
