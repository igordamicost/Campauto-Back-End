import { getPool } from "../db.js";

/**
 * Lista funcionários (users com dados em employees).
 * GET /pessoas/funcionarios - query: page, limit, q (busca por nome/email).
 */
async function listFuncionarios(req, res) {
  const pool = getPool();
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || req.query.perPage || 20)));
  const page = Math.max(1, Number(req.query.page || 1));
  const offset = (page - 1) * limit;
  const q = (req.query.q || "").trim();

  const where = [];
  const params = [];

  if (q) {
    where.push("(u.name LIKE ? OR u.email LIKE ? OR e.full_name LIKE ?)");
    const term = `%${q}%`;
    params.push(term, term, term);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
    SELECT u.id, u.name, u.email, u.role_id, u.blocked,
           e.id AS employee_id, e.full_name, e.phone
    FROM users u
    LEFT JOIN employees e ON e.user_id = u.id
    ${whereSql}
    ORDER BY COALESCE(e.full_name, u.name) ASC
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM users u LEFT JOIN employees e ON e.user_id = u.id ${whereSql}`,
    params
  );

  const total = Number(countRow.total);
  const totalPages = Math.ceil(total / limit) || 1;

  res.json({
    data: rows,
    page,
    perPage: limit,
    total,
    totalPages,
  });
}

export { listFuncionarios };
