import { transporter } from "../config/email.js";
import { DEFAULT_FROM } from "../config/mail.js";

export async function sendEmail(to, subject, html) {
  return transporter.sendMail({
    from: DEFAULT_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}
