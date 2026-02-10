import { transporter } from "../config/email.js";

export async function sendEmail(to, subject, html) {
  return transporter.sendMail({
    from: `JR Carpeças <${process.env.SMTP_USER}>`,
    to,
    subject,
    html
  });
}
