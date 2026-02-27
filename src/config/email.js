import nodemailer from "nodemailer";
import { toASCII } from "node:punycode";
import "./env.js";
import {
  HOSTINGER_SMTP_HOST,
  HOSTINGER_SMTP_PORT,
  HOSTINGER_SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
} from "./mail.js";

function toSmtpAsciiUser(email) {
  const [localPart, domain] = (email || "").split("@");
  if (!localPart || !domain) {
    return email;
  }

  return `${localPart}@${toASCII(domain)}`;
}

const smtpUserASCII = toSmtpAsciiUser(SMTP_USER || "");

function createTransporter() {
  return nodemailer.createTransport({
    host: HOSTINGER_SMTP_HOST,
    port: HOSTINGER_SMTP_PORT,
    secure: HOSTINGER_SMTP_SECURE,
    auth: {
      user: smtpUserASCII,
      pass: SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
    debug: true,
    logger: true,
  });
}

export let transporter = createTransporter();

export async function verifyEmailConnection() {
  try {
    await transporter.verify();
    console.log(`SMTP pronto em ${HOSTINGER_SMTP_HOST}:${HOSTINGER_SMTP_PORT}`);
  } catch (error) {
    const detail = error?.message || String(error);
    console.warn(
      `Falha ao validar SMTP em ${HOSTINGER_SMTP_HOST}:${HOSTINGER_SMTP_PORT}: ${detail}`
    );
    console.warn("SMTP indisponível, aplicação continuará sem e-mail");
  }
}
