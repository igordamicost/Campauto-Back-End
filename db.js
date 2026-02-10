import mysql from "mysql2/promise";
import "./src/config/env.js";
import { db } from "./src/config/database.js";

const {
  DB_HOST = "localhost",
  DB_PORT = 3306,
  DB_USER = "admin",
  DB_PASS = "admin",
  DB_NAME = "campauto"
} = process.env;

async function createDatabaseIfNotExists() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    multipleStatements: true,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
  await connection.end();
}

async function initDb() {
  const maxRetries = 20;
  const delayMs = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await createDatabaseIfNotExists();
      await db.query("SELECT 1");
      return db;
    } catch (err) {
      console.warn(`DB connection attempt ${attempt} failed. Retrying...`);
      if (attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return db;
}

function getPool() {
  return db;
}

export { initDb, getPool };
