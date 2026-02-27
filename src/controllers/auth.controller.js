import bcrypt from "bcryptjs";
import { db } from "../config/database.js";
import { createPasswordToken, consumeToken } from "../services/passwordTokenService.js";
import { sendEmail } from "../services/email.service.js";
import { getTemplate, renderWithData } from "../services/templateService.js";

function isMasterRole(roleString, roleId) {
  const role = String(roleString || "").toUpperCase();
  return role === "MASTER" || roleId === 1;
}

const PASSWORD_SCHEMA = {
  /**
   * Pelo menos:
   * - 1 letra maiúscula
   * - 1 dígito
   * - 1 caractere especial
   * - 8 caracteres no total
   */
  strongRegex: /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/,
};

function validatePassword(pwd) {
  if (!pwd || typeof pwd !== "string") return "Senha inválida";
  if (!PASSWORD_SCHEMA.strongRegex.test(pwd)) {
    return "A senha deve ter no mínimo 8 caracteres, contendo pelo menos uma letra maiúscula, um número e um caractere especial.";
  }
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
    return res.status(200).json({
      ...genericMessage,
      debug: "INVALID_EMAIL",
    });
  }

  const [rows] = await db.query(
    `
      SELECT 
        u.id,
        u.name,
        u.role,
        u.role_id,
        u.empresa_id,
        e.nome_fantasia,
        e.razao_social,
        e.cnpj,
        e.endereco,
        e.cidade,
        e.estado,
        e.telefone,
        e.logo_base64
      FROM users u
      LEFT JOIN empresas e ON e.id = u.empresa_id
      WHERE u.email = ?
      LIMIT 1
    `,
    [email.trim()]
  );

  if (rows.length === 0) {
    return res.status(200).json({
      ...genericMessage,
      debug: "USER_NOT_FOUND",
    });
  }

  const user = rows[0];

  try {
    const token = await createPasswordToken(user.id, "RESET");
    const link = `${process.env.FRONT_URL}/recuperar-senha?token=${token}`;
    const defaultCompanyName = process.env.COMPANY_NAME || "Campauto";

    const roleStr = user.role;
    const roleId = user.role_id;
    const isMaster = isMasterRole(roleStr, roleId);

    // Regra: usuários não-master precisam ter empresa vinculada para enviar e-mail de reset
    if (!isMaster && !user.empresa_id) {
      // Não envia e-mail, mas mantém resposta genérica
      return res.status(200).json({
        ...genericMessage,
        debug: "NON_MASTER_NO_EMPRESA",
      });
    }

    const empresaNome =
      user.nome_fantasia || user.razao_social || defaultCompanyName;
    const logoBase64 = user.logo_base64 || null;
    const companyLogo = logoBase64
      ? `data:image/png;base64,${logoBase64}`
      : null;

    const userName = user.name || "";

    const template = await getTemplate(null, "RESET");
    const { subject, html } = renderWithData(template, {
      user_name: userName,
      user_email: email.trim(),
      action_url: link,
      token_expires_in: "1 hora",
      company_name: empresaNome,
      company_logo: companyLogo,
    });

    console.log("[forgotPassword] Enviando e-mail de reset para", email.trim());
    await sendEmail(email.trim(), subject, html);
    console.log("[forgotPassword] E-mail de reset enviado (sem erro aparente)");
  } catch (err) {
    console.error(
      "[forgotPassword] Erro ao enviar e-mail de recuperação:",
      err?.message || err
    );
    return res.status(200).json({
      ...genericMessage,
      debug: "EMAIL_SEND_ERROR",
      error: err?.message || String(err),
    });
  }

  return res.status(200).json({
    ...genericMessage,
    debug: "EMAIL_SENT",
  });
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

  return res.json({ message: "Senha alterada com sucesso" });
}
