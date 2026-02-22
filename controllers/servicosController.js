import { getPool } from "../db.js";

const TABLE_SERVICOS = "servicos";
const TABLE_ITENS = "servico_itens";

// ---------- Serviços (CRUD) ----------

async function list(req, res) {
  const pool = getPool();
  const q = String(req.query.q || "").trim();
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || req.query.perPage || 50)));
  const page = Math.max(1, Number(req.query.page || 1));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  if (q) {
    where.push("(nome LIKE ? OR codigo LIKE ? OR descricao LIKE ?)");
    const term = `%${q}%`;
    params.push(term, term, term);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT id, nome, codigo, descricao, created_at, updated_at
     FROM ${TABLE_SERVICOS}
     ${whereSql}
     ORDER BY nome ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM ${TABLE_SERVICOS} ${whereSql}`,
    params
  );
  const total = Number(countRow?.total || 0);

  const data = rows.map((row) => ({
    id: row.id,
    nome: row.nome,
    codigo: row.codigo ?? null,
    descricao: row.descricao ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  res.json({ data, total, page, perPage: limit });
}

async function getById(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);
  const [rows] = await pool.query(
    `SELECT id, nome, codigo, descricao, created_at, updated_at FROM ${TABLE_SERVICOS} WHERE id = ?`,
    [id]
  );
  const item = rows[0];
  if (!item) {
    return res.status(404).json({ message: "Serviço não encontrado" });
  }
  res.json({
    id: item.id,
    nome: item.nome,
    codigo: item.codigo ?? null,
    descricao: item.descricao ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  });
}

async function create(req, res) {
  const pool = getPool();
  const nome = String(req.body?.nome ?? "").trim();
  if (!nome) {
    return res.status(400).json({ message: "nome é obrigatório" });
  }
  const codigo = req.body?.codigo != null ? String(req.body.codigo).trim() || null : null;
  const descricao = req.body?.descricao != null ? String(req.body.descricao).trim() || null : null;

  const [result] = await pool.query(
    `INSERT INTO ${TABLE_SERVICOS} (nome, codigo, descricao) VALUES (?, ?, ?)`,
    [nome, codigo, descricao]
  );
  const id = result.insertId;
  const [rows] = await pool.query(
    `SELECT id, nome, codigo, descricao, created_at, updated_at FROM ${TABLE_SERVICOS} WHERE id = ?`,
    [id]
  );
  res.status(201).json(rows[0]);
}

async function update(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);
  const [existing] = await pool.query(`SELECT id FROM ${TABLE_SERVICOS} WHERE id = ?`, [id]);
  if (existing.length === 0) {
    return res.status(404).json({ message: "Serviço não encontrado" });
  }

  const updates = [];
  const params = [];
  if (req.body?.nome !== undefined) {
    const nome = String(req.body.nome).trim();
    if (!nome) return res.status(400).json({ message: "nome não pode ser vazio" });
    updates.push("nome = ?");
    params.push(nome);
  }
  if (req.body?.codigo !== undefined) {
    updates.push("codigo = ?");
    params.push(req.body.codigo ? String(req.body.codigo).trim() : null);
  }
  if (req.body?.descricao !== undefined) {
    updates.push("descricao = ?");
    params.push(req.body.descricao ? String(req.body.descricao).trim() : null);
  }

  if (updates.length === 0) {
    const [rows] = await pool.query(
      `SELECT id, nome, codigo, descricao, created_at, updated_at FROM ${TABLE_SERVICOS} WHERE id = ?`,
      [id]
    );
    return res.json(rows[0]);
  }
  params.push(id);
  await pool.query(`UPDATE ${TABLE_SERVICOS} SET ${updates.join(", ")} WHERE id = ?`, params);
  const [rows] = await pool.query(
    `SELECT id, nome, codigo, descricao, created_at, updated_at FROM ${TABLE_SERVICOS} WHERE id = ?`,
    [id]
  );
  res.json(rows[0]);
}

async function remove(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);
  const [existing] = await pool.query(`SELECT id FROM ${TABLE_SERVICOS} WHERE id = ?`, [id]);
  if (existing.length === 0) {
    return res.status(404).json({ message: "Serviço não encontrado" });
  }
  await pool.query(`DELETE FROM ${TABLE_SERVICOS} WHERE id = ?`, [id]);
  res.status(204).send();
}

// ---------- Itens do checklist (por serviço) ----------

async function listItens(req, res) {
  const pool = getPool();
  const servicoId = Number(req.params.servicoId);
  const [servico] = await pool.query(`SELECT id FROM ${TABLE_SERVICOS} WHERE id = ?`, [servicoId]);
  if (servico.length === 0) {
    return res.status(404).json({ message: "Serviço não encontrado" });
  }

  const [rows] = await pool.query(
    `SELECT id, servico_id, descricao, ordem, created_at
     FROM ${TABLE_ITENS}
     WHERE servico_id = ?
     ORDER BY ordem ASC, id ASC`,
    [servicoId]
  );
  const data = rows.map((r) => ({
    id: r.id,
    servico_id: r.servico_id,
    descricao: r.descricao,
    nome: r.descricao,
    ordem: r.ordem ?? null,
  }));
  res.json(data);
}

async function createItem(req, res) {
  const pool = getPool();
  const servicoId = Number(req.params.servicoId);
  const descricao = String(req.body?.descricao ?? "").trim();
  if (!descricao) {
    return res.status(400).json({ message: "descricao é obrigatória" });
  }

  const [servico] = await pool.query(`SELECT id FROM ${TABLE_SERVICOS} WHERE id = ?`, [servicoId]);
  if (servico.length === 0) {
    return res.status(404).json({ message: "Serviço não encontrado" });
  }

  const ordem = req.body?.ordem != null ? Number(req.body.ordem) : null;
  const [result] = await pool.query(
    `INSERT INTO ${TABLE_ITENS} (servico_id, descricao, ordem) VALUES (?, ?, ?)`,
    [servicoId, descricao, ordem]
  );
  const id = result.insertId;
  const [rows] = await pool.query(
    `SELECT id, servico_id, descricao, ordem, created_at FROM ${TABLE_ITENS} WHERE id = ?`,
    [id]
  );
  const item = rows[0];
  res.status(201).json({
    id: item.id,
    servico_id: item.servico_id,
    descricao: item.descricao,
    nome: item.descricao,
    ordem: item.ordem ?? null,
  });
}

async function updateItem(req, res) {
  const pool = getPool();
  const servicoId = Number(req.params.servicoId);
  const itemId = Number(req.params.id);

  const [existing] = await pool.query(
    `SELECT id FROM ${TABLE_ITENS} WHERE id = ? AND servico_id = ?`,
    [itemId, servicoId]
  );
  if (existing.length === 0) {
    return res.status(404).json({ message: "Item não encontrado" });
  }

  const updates = [];
  const params = [];
  if (req.body?.descricao !== undefined) {
    const descricao = String(req.body.descricao).trim();
    if (!descricao) return res.status(400).json({ message: "descricao não pode ser vazia" });
    updates.push("descricao = ?");
    params.push(descricao);
  }
  if (req.body?.ordem !== undefined) {
    updates.push("ordem = ?");
    params.push(req.body.ordem == null ? null : Number(req.body.ordem));
  }

  if (updates.length > 0) {
    params.push(itemId);
    await pool.query(`UPDATE ${TABLE_ITENS} SET ${updates.join(", ")} WHERE id = ?`, params);
  }
  const [rows] = await pool.query(
    `SELECT id, servico_id, descricao, ordem, created_at FROM ${TABLE_ITENS} WHERE id = ?`,
    [itemId]
  );
  const item = rows[0];
  res.json({
    id: item.id,
    servico_id: item.servico_id,
    descricao: item.descricao,
    nome: item.descricao,
    ordem: item.ordem ?? null,
  });
}

async function removeItem(req, res) {
  const pool = getPool();
  const servicoId = Number(req.params.servicoId);
  const itemId = Number(req.params.id);
  const [result] = await pool.query(
    `DELETE FROM ${TABLE_ITENS} WHERE id = ? AND servico_id = ?`,
    [itemId, servicoId]
  );
  if (result.affectedRows === 0) {
    return res.status(404).json({ message: "Item não encontrado" });
  }
  res.status(204).send();
}

export {
  list,
  getById,
  create,
  update,
  remove,
  listItens,
  createItem,
  updateItem,
  removeItem,
};
