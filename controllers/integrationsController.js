import { z } from "zod";
import { encrypt } from "../src/services/cryptoService.js";
import { sendEmail, updateIntegrationTestResult } from "../src/services/gmailService.js";
import { getPool } from "../db.js";

const configSchema = z
  .object({
    senderEmail: z.string().email(),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    refreshToken: z.string().min(1),
  })
  .strict();

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

const exchangeCodeSchema = z
  .object({
    code: z.string().min(1),
    redirectUri: z.string().url(),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
  })
  .strict();

/**
 * Troca o code OAuth do Google por refresh_token.
 * Deve ser chamado apenas pelo backend (nunca expor clientSecret no front).
 * Retorna { refreshToken, senderEmail? }.
 */
async function exchangeCode(req, res) {
  const parsed = exchangeCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Dados inválidos",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { code, redirectUri, clientId, clientSecret } = parsed.data;

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  let tokenRes;
  try {
    tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (err) {
    console.error("Erro ao chamar Google OAuth:", err?.message);
    return res.status(502).json({ message: "Falha ao comunicar com Google" });
  }

  const data = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok) {
    return res.status(400).json({
      message: data.error_description || data.error || "Falha ao trocar code por token",
    });
  }

  const refreshToken = data.refresh_token || null;
  if (!refreshToken) {
    return res.status(400).json({
      message: "Google não retornou refresh_token. Verifique se o consentimento inclui acesso offline.",
    });
  }

  let senderEmail = null;
  const accessToken = data.access_token;
  if (accessToken) {
    try {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        senderEmail = userData.email || null;
      }
    } catch {
      // opcional
    }
  }

  return res.json({ refreshToken, senderEmail });
}

export { configGoogleMail, testGoogleMail, exchangeCode };
