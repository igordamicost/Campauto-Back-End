import nodemailer from "nodemailer";
import { toASCII } from "node:punycode";
import "./env.js";

function sanitizeEnvValue(value = "") {
  return String(value).trim().replace(/^(['"])(.*)\1$/, "$2");
}

const smtpHost = sanitizeEnvValue(process.env.SMTP_HOST || "smtp.hostinger.com");
const smtpUser = sanitizeEnvValue(process.env.SMTP_USER);
const smtpPass = sanitizeEnvValue(process.env.SMTP_PASS);
const configuredPort = Number.parseInt(sanitizeEnvValue(process.env.SMTP_PORT || ""), 10);

function toSmtpAsciiUser(email) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return email;
  }

  return `${localPart}@${toASCII(domain)}`;
}

const smtpUserASCII = toSmtpAsciiUser(smtpUser);

function createTransporter({ port, secure }) {
  return nodemailer.createTransport({
    host: smtpHost,
    port,
    secure,
    auth: {
      user: smtpUserASCII,
      pass: smtpPass
    },
    tls: { rejectUnauthorized: false },
    debug: true,
    logger: true
  });
}

const candidatePorts = [configuredPort, 465, 587]
  .filter((port) => Number.isInteger(port) && port > 0)
  .filter((port, index, list) => list.indexOf(port) === index);

export let transporter = createTransporter({
  port: candidatePorts[0] ?? 465,
  secure: (candidatePorts[0] ?? 465) === 465
});

export async function verifyEmailConnection() {
  for (const port of candidatePorts.length ? candidatePorts : [465, 587]) {
    const secure = port === 465;
    transporter = createTransporter({ port, secure });

    try {
      await transporter.verify();
      console.log(`SMTP pronto em ${smtpHost}:${port}`);
      return;
    } catch (error) {
      const detail = error?.message || String(error);
      console.warn(`Falha ao validar SMTP em ${smtpHost}:${port}: ${detail}`);
    }
  }

  console.warn("SMTP indisponível, aplicação continuará sem e-mail");
}
