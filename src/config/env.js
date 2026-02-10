import dotenv from "dotenv";

dotenv.config();

const requiredVars = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASS",
  "DB_NAME",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS"
];

const missing = requiredVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`❌ Variáveis ausentes: ${missing.join(", ")}`);
  throw new Error(`Missing env vars: ${missing.join(", ")}`);
}
