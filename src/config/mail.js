import "./env.js";
import { transporter } from "./email.js";

export { transporter };
export const from = process.env.SMTP_USER;
