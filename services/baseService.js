import crypto from "crypto";
import { getPool } from "../db.js";

const columnsCache = new Map();

async function getTableColumns(table) {
  if (columnsCache.has(table)) return columnsCache.get(table);
  const pool = getPool();
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
  const columns = rows
    .map((row) => row.Field)
    .filter((field) => !['id', 'row_hash'].includes(field));
  columnsCache.set(table, columns);
  return columns;
}

function computeRowHash(values) {
  const hash = crypto.createHash('md5');
  for (const value of values) {
    hash.update(String(value ?? ''));
    hash.update('|');
  }
  return hash.digest('hex');
}

async function list(table, limit = 10, offset = 0) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT * FROM \`${table}\` ORDER BY id DESC LIMIT ? OFFSET ?`,
    [Number(limit), Number(offset)]
  );
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM \`${table}\``
  );
  return { data: rows, total: Number(countRow.total) };
}

async function getById(table, id) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT * FROM \`${table}\` WHERE id = ?`,
    [Number(id)]
  );
  return rows[0] || null;
}

async function create(table, data) {
  const pool = getPool();
  const columns = await getTableColumns(table);
  const payload = {};
  columns.forEach((col) => {
    if (data[col] !== undefined) payload[col] = data[col];
  });

  const values = columns.map((col) => payload[col] ?? null);
  const rowHash = computeRowHash(values);

  const insertSql = `
    INSERT IGNORE INTO \`${table}\`
    (row_hash, ${columns.map((c) => `\`${c}\``).join(', ')})
    VALUES (?, ${columns.map(() => '?').join(', ')})
  `;
  const [result] = await pool.query(insertSql, [rowHash, ...values]);
  return result.insertId;
}

async function update(table, id, data) {
  const pool = getPool();
  const columns = await getTableColumns(table);
  const payload = {};
  columns.forEach((col) => {
    if (data[col] !== undefined) payload[col] = data[col];
  });

  const keys = Object.keys(payload);
  if (keys.length === 0) return false;

  const setSql = keys.map((c) => `\`${c}\` = ?`).join(', ');
  const values = keys.map((c) => payload[c]);
  const [result] = await pool.query(
    `UPDATE \`${table}\` SET ${setSql} WHERE id = ?`,
    [...values, Number(id)]
  );
  return result.affectedRows > 0;
}

async function remove(table, id) {
  const pool = getPool();
  const [result] = await pool.query(
    `DELETE FROM \`${table}\` WHERE id = ?`,
    [Number(id)]
  );
  return result.affectedRows > 0;
}

export { list, getById, create, update, remove };
