import bcrypt from "bcryptjs";
import { db } from "../config/database.js";
import { createPasswordToken, consumeToken } from "../services/passwordTokenService.js";
import { sendEmail } from "../services/gmailService.js";
import { getTemplate, renderWithData } from "../services/templateService.js";

const PASSWORD_SCHEMA = {
  minLength: 8,
  hasLetter: /[a-zA-Z]/,
  hasNumber: /\d/,
};

function validatePassword(pwd) {
  if (!pwd || typeof pwd !== "string") return "Senha inválida";
  if (pwd.length < PASSWORD_SCHEMA.minLength) return "Senha deve ter no mínimo 8 caracteres";
  if (!PASSWORD_SCHEMA.hasLetter.test(pwd)) return "Senha deve conter pelo menos 1 letra";
  if (!PASSWORD_SCHEMA.hasNumber.test(pwd)) return "Senha deve conter pelo menos 1 número";
  return null;
}

/**
 * Forgot-password: sempre responde 200 com mensagem genérica.
 * Rate limit aplicado na rota.
 */
export async function forgotPassword(req, res) {
  const { email } = req.body || {};

  const genericMessage = { message: "Se o email existir, você receberá instruções em breve" };

  if (!email || typeof email !== "string") {
    return res.status(200).json(genericMessage);
  }

  const [rows] = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [
    email.trim(),
  ]);

  if (rows.length === 0) {
    return res.status(200).json(genericMessage);
  }

  const user = rows[0];

  try {
    const token = await createPasswordToken(user.id, "RESET");
    const link = `${process.env.FRONT_URL}/recuperar-senha?token=${token}`;
    const companyName = process.env.COMPANY_NAME || "Campauto";

    const [userRow] = await db.query("SELECT name FROM users WHERE id = ?", [user.id]);
    const userName = userRow[0]?.name || "";

    const template = await getTemplate(null, "RESET");
    const { subject, html } = renderWithData(template, {
      user_name: userName,
      user_email: email.trim(),
      action_url: link,
      token_expires_in: "1 hora",
      company_name: companyName,
    });

    const result = await sendEmail(null, email.trim(), subject, html);
    if (!result.success) {
    }
  } catch (err) {
  }

  return res.status(200).json(genericMessage);
}

/**
 * Set-password: valida token, atualiza senha com bcrypt (cost 12).
 */
export async function setPassword(req, res) {
  const { token, newPassword } = req.body || {};

  if (!token) {
    return res.status(400).json({ message: "Token é obrigatório" });
  }

  const pwdError = validatePassword(newPassword);
  if (pwdError) {
    return res.status(400).json({ message: pwdError });
  }

  const userId = await consumeToken(token);
  if (!userId) {
    return res.status(400).json({ message: "Token inválido ou expirado" });
  }

  const hash = await bcrypt.hash(newPassword, 12);

  await db.query(
    "UPDATE users SET password = ?, must_set_password = 0 WHERE id = ?",
    [hash, userId]
  );

  return res.json({ ok: true });
}

/**
 * Reset-password: redefinir senha com token (link do e-mail de recuperação).
 * Body: { token, password } (front pode enviar "password" em vez de "newPassword").
 */
export async function resetPassword(req, res) {
  const { token, password, newPassword } = req.body || {};
  const pwd = password ?? newPassword;

  if (!token) {
    return res.status(400).json({ message: "Token é obrigatório" });
  }

  const pwdError = validatePassword(pwd);
  if (pwdError) {
    return res.status(400).json({ message: pwdError });
  }

  const userId = await consumeToken(token);
  if (!userId) {
    return res.status(400).json({ message: "Token inválido ou expirado" });
  }

  const hash = await bcrypt.hash(pwd, 12);

  await db.query(
    "UPDATE users SET password = ?, must_set_password = 0 WHERE id = ?",
    [hash, userId]
  );

  return res.json({ ok: true });
}
