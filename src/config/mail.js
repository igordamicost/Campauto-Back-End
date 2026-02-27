import "./env.js";

// Hostinger - SMTP (envia e-mail)
export const HOSTINGER_SMTP_HOST = "smtp.hostinger.com";
export const HOSTINGER_SMTP_PORT = 465;
export const HOSTINGER_SMTP_SECURE = true;

// Hostinger - IMAP (leitura de e-mail)
export const HOSTINGER_IMAP_HOST = "imap.hostinger.com";
export const HOSTINGER_IMAP_PORT = 993;
export const HOSTINGER_IMAP_SECURE = true;

// Hostinger - POP3 (leitura de e-mail)
export const HOSTINGER_POP3_HOST = "pop.hostinger.com";
export const HOSTINGER_POP3_PORT = 995;
export const HOSTINGER_POP3_SECURE = true;

// Credenciais SEMPRE vêm de variáveis de ambiente
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;

// Remetente padrão
export const DEFAULT_FROM_NAME = "JR Carpeças";
export const DEFAULT_FROM =
  SMTP_USER ? `${DEFAULT_FROM_NAME} <${SMTP_USER}>` : undefined;

