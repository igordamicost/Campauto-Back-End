import bcrypt from "bcrypt";
import { db } from "../config/database.js";
import { sendEmail } from "../services/email.service.js";
import { generateResetToken, verifyResetToken } from "../services/token.service.js";
import { resetPasswordTemplate } from "../templates/resetPasswordTemplate.js";

export async function forgotPassword(req, res) {
  const { email } = req.body;

  const [rows] = await db.query(
    "SELECT id, email FROM users WHERE email = ?",
    [email]
  );

  if (rows.length === 0) {
    return res.json({ message: "Se o email existir, você receberá instruções" });
  }

  const user = rows[0];

  const token = generateResetToken(user.id);

  const link = `${process.env.FRONT_URL}/reset-password?token=${token}`;

  const html = resetPasswordTemplate(link);

  await sendEmail(email, "Redefinição de senha", html);

  res.json({ message: "Email enviado" });
}

export async function resetPassword(req, res) {
  const { token, password } = req.body;

  const { userId } = verifyResetToken(token);

  const hash = await bcrypt.hash(password, 10);

  await db.query(
    "UPDATE users SET password = ? WHERE id = ?",
    [hash, userId]
  );

  res.json({ message: "Senha alterada com sucesso" });
}
