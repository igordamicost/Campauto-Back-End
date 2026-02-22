import { getPool } from "../db.js";

const TABLE = "cotacoes_compra";

/**
 * GET /cotacoes-compra/ultima?codigo_produto=XXX
 * Retorna a última cotação (valor_custo, local, data) para o código.
 */
async function getUltima(req, res) {
  const codigo = String(req.query.codigo_produto || "").trim();
  if (!codigo) {
    return res.status(400).json({ message: "codigo_produto é obrigatório" });
  }

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, codigo_produto, valor_custo, \`local\`, data, created_at
     FROM ${TABLE}
     WHERE codigo_produto = ?
     ORDER BY data DESC, id DESC
     LIMIT 1`,
    [codigo]
  );

  const item = rows[0];
  if (!item) {
    return res.status(404).json({ message: "Nenhuma cotação encontrada para este código" });
  }

  res.json({
    id: item.id,
    codigo_produto: item.codigo_produto,
    valor_custo: Number(item.valor_custo),
    local: item.local,
    data: item.data ? (item.data instanceof Date ? item.data.toISOString().slice(0, 10) : String(item.data).slice(0, 10)) : null,
  });
}

/**
 * POST /cotacoes-compra/ultimas
 * Body: { codigos: ["CODE1", "CODE2", ...] }
 * Retorna última cotação para cada código (array).
 */
async function getUltimas(req, res) {
  const codigos = req.body?.codigos;
  if (!Array.isArray(codigos) || codigos.length === 0) {
    return res.status(400).json({ message: "codigos deve ser um array não vazio" });
  }

  const list = codigos.map((c) => String(c ?? "").trim()).filter(Boolean);
  if (list.length === 0) {
    return res.json([]);
  }

  const pool = getPool();
  const placeholders = list.map(() => "?").join(",");

  const [rows] = await pool.query(
    `SELECT id, codigo_produto, valor_custo, \`local\`, data
     FROM ${TABLE}
     WHERE codigo_produto IN (${placeholders})
     ORDER BY data DESC, id DESC`,
    list
  );

  const byCode = new Map();
  for (const row of rows) {
    const code = row.codigo_produto;
    if (!byCode.has(code)) {
      byCode.set(code, {
        codigo_produto: code,
        valor_custo: Number(row.valor_custo),
        local: row.local,
        data: row.data ? (row.data instanceof Date ? row.data.toISOString().slice(0, 10) : String(row.data).slice(0, 10)) : null,
      });
    }
  }

  const result = list.map((codigo) => byCode.get(codigo)).filter(Boolean);
  res.json(result);
}

/**
 * POST /cotacoes-compra
 * Body: { codigo_produto, valor_custo, local, data? }
 * Sempre insere novo registro (histórico).
 */
async function create(req, res) {
  const { codigo_produto, valor_custo, local, data } = req.body || {};

  const codigo = String(codigo_produto ?? "").trim();
  if (!codigo) {
    return res.status(400).json({ message: "codigo_produto é obrigatório" });
  }
  const valor = Number(valor_custo);
  if (Number.isNaN(valor) || valor < 0) {
    return res.status(400).json({ message: "valor_custo é obrigatório e deve ser um número >= 0" });
  }
  const localStr = String(local ?? "").trim();
  if (!localStr) {
    return res.status(400).json({ message: "local é obrigatório" });
  }

  let dataCotacao = data;
  if (dataCotacao === undefined || dataCotacao === null || dataCotacao === "") {
    dataCotacao = new Date().toISOString().slice(0, 10);
  } else {
    dataCotacao = String(dataCotacao).slice(0, 10);
  }

  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO ${TABLE} (codigo_produto, valor_custo, \`local\`, data)
     VALUES (?, ?, ?, ?)`,
    [codigo, valor, localStr, dataCotacao]
  );

  const id = result.insertId;
  res.status(201).json({
    id,
    codigo_produto: codigo,
    valor_custo: valor,
    local: localStr,
    data: dataCotacao,
  });
}

export { getUltima, getUltimas, create };
