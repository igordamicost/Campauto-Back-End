import { getPool } from "../db.js";

const TABLE = "veiculos";

async function tableExists() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [TABLE]
  );
  return rows[0]?.cnt > 0;
}

async function list(req, res) {
  const exists = await tableExists();
  if (!exists) {
    return res.json({ data: [], page: 1, perPage: 10, total: 0, totalPages: 0 });
  }

  const pool = getPool();
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || req.query.perPage || 20)));
  const page = Math.max(1, Number(req.query.page || 1));
  const offset = (page - 1) * limit;
  const clienteId = req.query.cliente_id ?? req.query.clienteId;
  const q = (req.query.q || "").trim();

  const where = [];
  const params = [];

  if (clienteId) {
    where.push("v.cliente_id = ?");
    params.push(Number(clienteId));
  }

  if (q) {
    where.push("(v.marca LIKE ? OR v.modelo LIKE ? OR v.placa LIKE ? OR v.renavan LIKE ?)");
    const term = `%${q}%`;
    params.push(term, term, term, term);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countSql = `SELECT COUNT(*) AS total FROM \`${TABLE}\` v ${whereSql}`;
  const dataSql = `
    SELECT v.id, v.cliente_id, v.marca, v.modelo, v.placa, v.ano, v.renavan, v.chassi, v.cor, v.created_at, v.updated_at
    FROM \`${TABLE}\` v
    ${whereSql}
    ORDER BY v.id DESC
    LIMIT ? OFFSET ?
  `;

  const [[countRow]] = await pool.query(countSql, params);
  const [rows] = await pool.query(dataSql, [...params, limit, offset]);
  const total = Number(countRow.total);
  const totalPages = Math.ceil(total / limit) || 1;

  res.json({ data: rows, page, perPage: limit, total, totalPages });
}

async function getById(req, res) {
  const exists = await tableExists();
  if (!exists) return res.status(404).json({ message: "Not found" });

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, cliente_id, marca, modelo, placa, ano, renavan, chassi, cor, created_at, updated_at FROM \`${TABLE}\` WHERE id = ?`,
    [Number(req.params.id)]
  );
  const item = rows[0];
  if (!item) return res.status(404).json({ message: "Not found" });
  res.json(item);
}

async function create(req, res) {
  const exists = await tableExists();
  if (!exists) return res.status(503).json({ message: "Tabela de veículos não disponível" });

  const { cliente_id, marca, modelo, placa, ano, renavan, chassi, cor } = req.body || {};
  if (!cliente_id) {
    return res.status(400).json({ message: "cliente_id é obrigatório" });
  }
  const hasMarca = marca != null && String(marca).trim() !== "";
  const hasPlaca = placa != null && String(placa).trim() !== "";
  if (!hasMarca && !hasPlaca) {
    return res.status(400).json({ message: "Informe pelo menos marca ou placa" });
  }

  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO \`${TABLE}\` (cliente_id, marca, modelo, placa, ano, renavan, chassi, cor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(cliente_id),
      marca ? String(marca).trim() : null,
      modelo ? String(modelo).trim() : null,
      placa ? String(placa).trim() : null,
      ano ? String(ano).trim() : null,
      renavan ? String(renavan).trim() : null,
      chassi ? String(chassi).trim() : null,
      cor ? String(cor).trim() : null,
    ]
  );

  const [rows] = await pool.query(
    `SELECT id, cliente_id, marca, modelo, placa, ano, renavan, chassi, cor, created_at, updated_at FROM \`${TABLE}\` WHERE id = ?`,
    [result.insertId]
  );
  res.status(201).json(rows[0]);
}

async function update(req, res) {
  const exists = await tableExists();
  if (!exists) return res.status(404).json({ message: "Not found" });

  const pool = getPool();
  const id = Number(req.params.id);
  const { marca, modelo, placa, ano, renavan, chassi, cor } = req.body || {};

  const [current] = await pool.query(`SELECT id FROM \`${TABLE}\` WHERE id = ?`, [id]);
  if (!current[0]) return res.status(404).json({ message: "Not found" });

  const updates = [];
  const params = [];
  if (marca !== undefined) { updates.push("marca = ?"); params.push(marca ? String(marca).trim() : null); }
  if (modelo !== undefined) { updates.push("modelo = ?"); params.push(modelo ? String(modelo).trim() : null); }
  if (placa !== undefined) { updates.push("placa = ?"); params.push(placa ? String(placa).trim() : null); }
  if (ano !== undefined) { updates.push("ano = ?"); params.push(ano ? String(ano).trim() : null); }
  if (renavan !== undefined) { updates.push("renavan = ?"); params.push(renavan ? String(renavan).trim() : null); }
  if (chassi !== undefined) { updates.push("chassi = ?"); params.push(chassi ? String(chassi).trim() : null); }
  if (cor !== undefined) { updates.push("cor = ?"); params.push(cor ? String(cor).trim() : null); }

  if (updates.length === 0) {
    const [row] = await pool.query(
      `SELECT id, cliente_id, marca, modelo, placa, ano, renavan, chassi, cor, created_at, updated_at FROM \`${TABLE}\` WHERE id = ?`,
      [id]
    );
    return res.json(row[0]);
  }

  params.push(id);
  await pool.query(`UPDATE \`${TABLE}\` SET ${updates.join(", ")} WHERE id = ?`, params);

  const [rows] = await pool.query(
    `SELECT id, cliente_id, marca, modelo, placa, ano, renavan, chassi, cor, created_at, updated_at FROM \`${TABLE}\` WHERE id = ?`,
    [id]
  );
  res.json(rows[0]);
}

async function remove(req, res) {
  const exists = await tableExists();
  if (!exists) return res.status(404).json({ message: "Not found" });

  const pool = getPool();
  const id = Number(req.params.id);

  // Opcional: verificar se está em orçamento
  const orcamentosExist = await pool.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'orcamentos'"
  ).then(([r]) => r.length > 0);
  if (orcamentosExist) {
    const [used] = await pool.query("SELECT id FROM orcamentos WHERE veiculo_id = ? LIMIT 1", [id]);
    if (used.length > 0) {
      return res.status(409).json({
        message: "Veículo não pode ser excluído pois está vinculado a orçamento(s)",
      });
    }
  }

  const [result] = await pool.query(`DELETE FROM \`${TABLE}\` WHERE id = ?`, [id]);
  if (result.affectedRows === 0) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted" });
}

export { list, getById, create, update, remove };
