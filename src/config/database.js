import mysql from "mysql2/promise";
import "./env.js";

export const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: true // Permite executar múltiplos statements SQL
});

export async function verifyDbConnection() {
  try {
    await db.query("SELECT 1");
    console.log("✅ MySQL conectado");
  } catch (error) {
    const detail = error?.message || String(error);
    console.error(`❌ MySQL falhou: ${detail}`);
    throw error;
  }
}
