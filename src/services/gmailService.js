import { google } from "googleapis";
import { getPool } from "../../db.js";
import { decrypt } from "./cryptoService.js";

/**
 * Monta MIME em base64url para Gmail API.
 */
function buildRawEmail(to, subject, htmlBody, from) {
  const boundary = `boundary_${Date.now()}`;
  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(htmlBody, "utf8").toString("base64"),
    `--${boundary}--`,
  ].join("\r\n");

  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Carrega integração ACTIVE. Se masterUserId fornecido, usa a desse master;
 * senão usa a primeira ACTIVE encontrada (para forgot-password público).
 */
async function loadIntegration(masterUserId = null) {
  const pool = getPool();
  let rows;
  if (masterUserId) {
    [rows] = await pool.query(
      `
        SELECT owner_master_user_id, sender_email, client_id, client_secret_enc, client_secret_iv, client_secret_tag,
               refresh_token_enc, refresh_token_iv, refresh_token_tag
        FROM google_mail_integrations
        WHERE owner_master_user_id = ? AND status = 'ACTIVE'
      `,
      [masterUserId]
    );
  } else {
    [rows] = await pool.query(
      `
        SELECT owner_master_user_id, sender_email, client_id, client_secret_enc, client_secret_iv, client_secret_tag,
               refresh_token_enc, refresh_token_iv, refresh_token_tag
        FROM google_mail_integrations
        WHERE status = 'ACTIVE'
        LIMIT 1
      `
    );
  }

  const row = rows[0];
  if (!row) return null;

  const clientSecret = decrypt(
    row.client_secret_enc,
    row.client_secret_iv,
    row.client_secret_tag
  );
  const refreshToken = decrypt(
    row.refresh_token_enc,
    row.refresh_token_iv,
    row.refresh_token_tag
  );

  const oauth2Client = new google.auth.OAuth2(row.client_id, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return { oauth2Client, senderEmail: row.sender_email, ownerId: row.owner_master_user_id };
}

/**
 * Envia e-mail via Gmail API (users.messages.send).
 * @param {number} masterUserId - ID do usuário master (owner da integração)
 * @param {string} to - Destinatário
 * @param {string} subject - Assunto
 * @param {string} htmlBody - Corpo HTML
 * @returns {{ success: boolean, error?: string }}
 */
export async function sendEmail(masterUserIdOrNull, to, subject, htmlBody) {
  try {
    const integration = await loadIntegration(masterUserIdOrNull || null);
    if (!integration) {
      return { success: false, error: "Integração Gmail não configurada ou inativa" };
    }

    const { oauth2Client, senderEmail } = integration;
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const raw = buildRawEmail(to, subject, htmlBody, senderEmail);

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    return { success: true };
  } catch (err) {
    const msg = err?.message || String(err);
    const code = err?.response?.data?.error;

    if (code === "invalid_grant") {
      return { success: false, error: "Refresh token expirado ou revogado. Reconfigure a integração." };
    }
    if (msg.includes("insufficient") || msg.includes("permission")) {
      return { success: false, error: "Permissões insuficientes do Gmail. Verifique o escopo OAuth." };
    }

    return { success: false, error: msg };
  }
}

/**
 * Atualiza last_tested_at e last_error da integração.
 */
export async function updateIntegrationTestResult(masterUserId, success, errorMsg = null) {
  const pool = getPool();
  await pool.query(
    `
      UPDATE google_mail_integrations
      SET last_tested_at = NOW(), last_error = ?
      WHERE owner_master_user_id = ?
    `,
    [success ? null : errorMsg, masterUserId]
  );
}
