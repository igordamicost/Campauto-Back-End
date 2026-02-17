import { z } from "zod";
import { encrypt } from "../src/services/cryptoService.js";
import { sendEmail, updateIntegrationTestResult } from "../src/services/gmailService.js";
import { getPool } from "../db.js";

const configSchema = z.object({
  senderEmail: z.string().email(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  refreshToken: z.string().min(1),
});

async function configGoogleMail(req, res) {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Dados inválidos",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { senderEmail, clientId, clientSecret, refreshToken } = parsed.data;
  const masterUserId = req.user.userId;

  try {
    const encSecret = encrypt(clientSecret);
    const encRefresh = encrypt(refreshToken);

    const pool = getPool();
    await pool.query(
      `
      INSERT INTO google_mail_integrations
        (owner_master_user_id, sender_email, client_id,
         client_secret_enc, client_secret_iv, client_secret_tag,
         refresh_token_enc, refresh_token_iv, refresh_token_tag, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      ON DUPLICATE KEY UPDATE
        sender_email = VALUES(sender_email),
        client_id = VALUES(client_id),
        client_secret_enc = VALUES(client_secret_enc),
        client_secret_iv = VALUES(client_secret_iv),
        client_secret_tag = VALUES(client_secret_tag),
        refresh_token_enc = VALUES(refresh_token_enc),
        refresh_token_iv = VALUES(refresh_token_iv),
        refresh_token_tag = VALUES(refresh_token_tag),
        status = 'ACTIVE',
        last_error = NULL,
        updated_at = NOW()
    `,
      [
        masterUserId,
        senderEmail,
        clientId,
        encSecret.encrypted,
        encSecret.iv,
        encSecret.authTag,
        encRefresh.encrypted,
        encRefresh.iv,
        encRefresh.authTag,
      ]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao salvar integração Google (sem logar segredos)", err?.message);
    return res.status(500).json({ message: "Erro ao salvar configuração" });
  }
}

async function testGoogleMail(req, res) {
  const masterUserId = req.user.userId;
  const pool = getPool();

  const [rows] = await pool.query(
    "SELECT email FROM users WHERE id = ?",
    [masterUserId]
  );
  const toEmail = rows[0]?.email || req.body?.email;
  if (!toEmail) {
    return res.status(400).json({ message: "Não foi possível obter e-mail de destino" });
  }

  const result = await sendEmail(
    masterUserId,
    toEmail,
    "Teste - Integração Gmail",
    "<p>E-mail de teste enviado com sucesso.</p>"
  );

  await updateIntegrationTestResult(masterUserId, result.success, result.error);

  if (result.success) {
    return res.json({ ok: true, message: "E-mail de teste enviado" });
  }
  return res.status(500).json({ message: result.error || "Falha ao enviar e-mail" });
}

export { configGoogleMail, testGoogleMail };
