import nodemailer from "nodemailer";
import { toASCII } from "node:punycode";
import "./env.js";

const email = process.env.SMTP_USER;
const [localPart, domain] = email.split("@");
const asciiDomain = toASCII(domain);
const smtpUserASCII = `${localPart}@${asciiDomain}`;

function createTransporter({ port, secure }) {
  return nodemailer.createTransport({
    host: "smtp.hostinger.com",
    port,
    secure,
    auth: {
      user: smtpUserASCII,
      pass: process.env.SMTP_PASS
    },
    tls: { rejectUnauthorized: false },
    debug: true,
    logger: true
  });
}

export let transporter = createTransporter({ port: 465, secure: true });

export async function verifyEmailConnection() {
  try {
    await transporter.verify();
    console.log("SMTP pronto");
  } catch (error) {
    transporter = createTransporter({ port: 587, secure: false });
    try {
      await transporter.verify();
      console.log("SMTP pronto");
    } catch (fallbackError) {
      const detail = fallbackError?.message || String(fallbackError);
      console.warn(`SMTP indisponível, aplicação continuará sem e-mail: ${detail}`);
    }
  }
}
