import "./src/config/env.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import csv from "csv-parser";
import { fileURLToPath } from "url";
import { getPool, initDb } from "./db.js";

const CSV_DIRS = [
  path.join(process.cwd(), "Tabelas"),
  path.join(process.cwd(), "tabelas")
];
const CSV_SEPARATOR = ";";

function normalizeColumnName(name, used) {
  let normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_");

  if (!normalized) normalized = "col";
  if (/^\d/.test(normalized)) normalized = `col_${normalized}`;

  if (["id", "row_hash"].includes(normalized)) {
    normalized = `${normalized}_col`;
  }

  let unique = normalized;
  let counter = 1;
  while (used.has(unique)) {
    unique = `${normalized}_${counter}`;
    counter += 1;
  }
  used.add(unique);
  return unique;
}

function detectType(value) {
  const v = String(value).trim();
  if (!v) return null;

  if (/^(true|false|0|1|s|n|sim|nao|não)$/i.test(v)) {
    return "boolean";
  }
  if (/^-?\d+$/.test(v)) {
    return "int";
  }
  if (/^-?\d+[.,]\d+$/.test(v)) {
    return "decimal";
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(v)) {
    return "datetime";
  }
  if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/.test(v)) {
    return "datetime";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v) || /^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    return "date";
  }

  return "string";
}

function mergeType(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  if (prev === "string" || next === "string") return "string";

  if (
    (prev === "date" && next === "datetime") ||
    (prev === "datetime" && next === "date")
  ) {
    return "datetime";
  }

  if (
    (prev === "int" && next === "decimal") ||
    (prev === "decimal" && next === "int")
  ) {
    return "decimal";
  }

  if (
    (prev === "boolean" && next === "int") ||
    (prev === "int" && next === "boolean")
  ) {
    return "int";
  }

  if (
    (prev === "boolean" && next === "decimal") ||
    (prev === "decimal" && next === "boolean")
  ) {
    return "decimal";
  }

  if (prev === next) return prev;

  return "string";
}

function sqlTypeFor(columnStats) {
  const { type, maxLength } = columnStats;
  if (type === "int") return "INT";
  if (type === "decimal") return "DECIMAL(15,4)";
  if (type === "date") return "DATE";
  if (type === "datetime") return "DATETIME";
  if (type === "boolean") return "TINYINT(1)";

  if (maxLength > 255) return "TEXT";
  const length = Math.max(1, Math.min(255, maxLength || 255));
  return `VARCHAR(${length})`;
}

function computeRowHash(values) {
  const hash = crypto.createHash("md5");
  for (const value of values) {
    hash.update(String(value ?? ""));
    hash.update("|");
  }
  return hash.digest("hex");
}

async function inferSchema(filePath) {
  const stats = {};
  let headers = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ separator: CSV_SEPARATOR }))
      .on("headers", (h) => {
        headers = h;
        h.forEach((header) => {
          stats[header] = {
            type: null,
            maxLength: 0
          };
        });
      })
      .on("data", (row) => {
        headers.forEach((header) => {
          const value = row[header];
          if (value === undefined || value === null) return;
          const str = String(value).trim();
          if (!str) return;
          const col = stats[header];
          col.maxLength = Math.max(col.maxLength, str.length);
          const detected = detectType(str);
          col.type = mergeType(col.type, detected);
        });
      })
      .on("error", reject)
      .on("end", resolve);
  });

  const used = new Set();
  const columns = headers.map((header) => {
    const db = normalizeColumnName(header, used);
    const sqlType = sqlTypeFor(stats[header]);
    return { header, db, sqlType };
  });

  return { columns };
}

async function createTableIfNotExists(tableName, columns) {
  const pool = getPool();
  const columnsSql = columns
    .map((col) => `\`${col.db}\` ${col.sqlType} NULL`)
    .join(",\n  ");

  const createSql = `
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      row_hash CHAR(32) NOT NULL,
      ${columnsSql},
      UNIQUE KEY uniq_row_hash (row_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await pool.query(createSql);
}

async function insertCsvData(filePath, tableName, columns) {
  const pool = getPool();
  const dbColumns = columns.map((c) => c.db);

  const insertSql = `
    INSERT IGNORE INTO \`${tableName}\`
    (row_hash, ${dbColumns.map((c) => `\`${c}\``).join(", ")})
    VALUES ?
  `;

  const batchSize = 500;
  let batch = [];

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath).pipe(
      csv({ separator: CSV_SEPARATOR })
    );

    const flushBatch = async () => {
      if (batch.length === 0) return;
      const current = batch;
      batch = [];
      await pool.query(insertSql, [current]);
    };

    stream.on("data", async (row) => {
      stream.pause();
      try {
        const values = columns.map((col) => row[col.header] ?? null);
        const rowHash = computeRowHash(values);
        batch.push([rowHash, ...values]);

        if (batch.length >= batchSize) {
          await flushBatch();
        }
        stream.resume();
      } catch (err) {
        reject(err);
      }
    });

    stream.on("error", reject);
    stream.on("end", async () => {
      try {
        await flushBatch();
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function importCsvFile(filePath, tableName) {
  const { columns } = await inferSchema(filePath);
  await createTableIfNotExists(tableName, columns);
  await insertCsvData(filePath, tableName, columns);
}

function resolveCsvDir() {
  for (const dir of CSV_DIRS) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    if (files.some((f) => f.endsWith(".csv"))) {
      return dir;
    }
  }
  const dir = CSV_DIRS.find((d) => fs.existsSync(d));
  return dir || CSV_DIRS[0];
}

async function importAllCsv() {
  const csvDir = resolveCsvDir();
  if (!fs.existsSync(csvDir)) {
    console.warn(`CSV directory not found: ${csvDir}`);
    return;
  }

  const files = fs.readdirSync(csvDir).filter((f) => f.endsWith(".csv"));
  for (const file of files) {
    const filePath = path.join(csvDir, file);
    const tableName = path.parse(file).name.toLowerCase();
    console.log(`Importing ${file} -> ${tableName}`);
    await importCsvFile(filePath, tableName);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  initDb()
    .then(importAllCsv)
    .then(() => {
      console.log("CSV import completed.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("CSV import failed:", err);
      process.exit(1);
    });
}

export { importAllCsv };
