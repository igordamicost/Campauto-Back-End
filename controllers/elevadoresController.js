import { getPool } from "../db.js";

const TABLE = "elevadores";

async function list(req, res) {
  const pool = getPool();
  const empresaId = req.query.empresa_id != null ? Number(req.query.empresa_id) : null;
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || req.query.perPage || 100)));
  const page = Math.max(1, Number(req.query.page || 1));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  if (empresaId != null && !Number.isNaN(empresaId)) {
    where.push("e.empresa_id = ?");
    params.push(empresaId);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT e.id, e.nome, e.empresa_id, e.created_at, e.updated_at,
            emp.nome_fantasia AS empresa_nome_fantasia,
            emp.razao_social AS empresa_razao_social
     FROM ${TABLE} e
     LEFT JOIN empresas emp ON emp.id = e.empresa_id
     ${whereSql}
     ORDER BY e.nome ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM ${TABLE} e ${whereSql}`,
    params
  );
  const total = Number(countRow?.total || 0);

  const data = rows.map((row) => ({
    id: row.id,
    nome: row.nome,
    empresa_id: row.empresa_id,
    empresa_nome: row.empresa_nome_fantasia || row.empresa_razao_social || null,
    empresa: row.empresa_id
      ? {
          id: row.empresa_id,
          nome_fantasia: row.empresa_nome_fantasia,
          razao_social: row.empresa_razao_social,
        }
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  res.json({ data, total, page, perPage: limit });
}

async function getById(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);
  const [rows] = await pool.query(
    `SELECT e.id, e.nome, e.empresa_id, e.created_at, e.updated_at,
            emp.nome_fantasia AS empresa_nome_fantasia,
            emp.razao_social AS empresa_razao_social
     FROM ${TABLE} e
     LEFT JOIN empresas emp ON emp.id = e.empresa_id
     WHERE e.id = ?`,
    [id]
  );
  const row = rows[0];
  if (!row) {
    return res.status(404).json({ message: "Elevador não encontrado" });
  }
  res.json({
    id: row.id,
    nome: row.nome,
    empresa_id: row.empresa_id,
    empresa_nome: row.empresa_nome_fantasia || row.empresa_razao_social || null,
    empresa: row.empresa_id
      ? {
          id: row.empresa_id,
          nome_fantasia: row.empresa_nome_fantasia,
          razao_social: row.empresa_razao_social,
        }
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

async function create(req, res) {
  const pool = getPool();
  const nome = String(req.body?.nome ?? "").trim();
  const empresaId = req.body?.empresa_id != null ? Number(req.body.empresa_id) : null;

  if (!nome) {
    return res.status(400).json({ message: "nome é obrigatório" });
  }
  if (empresaId == null || Number.isNaN(empresaId)) {
    return res.status(400).json({ message: "empresa_id é obrigatório" });
  }

  const [empresaRows] = await pool.query("SELECT id FROM empresas WHERE id = ?", [empresaId]);
  if (empresaRows.length === 0) {
    return res.status(400).json({ message: "empresa_id inválido" });
  }

  const [result] = await pool.query(
    `INSERT INTO ${TABLE} (nome, empresa_id) VALUES (?, ?)`,
    [nome, empresaId]
  );
  const id = result.insertId;
  const [rows] = await pool.query(
    `SELECT e.id, e.nome, e.empresa_id, e.created_at, e.updated_at,
            emp.nome_fantasia AS empresa_nome_fantasia,
            emp.razao_social AS empresa_razao_social
     FROM ${TABLE} e
     LEFT JOIN empresas emp ON emp.id = e.empresa_id
     WHERE e.id = ?`,
    [id]
  );
  const row = rows[0];
  res.status(201).json({
    id: row.id,
    nome: row.nome,
    empresa_id: row.empresa_id,
    empresa_nome: row.empresa_nome_fantasia || row.empresa_razao_social || null,
    empresa: row.empresa_id
      ? {
          id: row.empresa_id,
          nome_fantasia: row.empresa_nome_fantasia,
          razao_social: row.empresa_razao_social,
        }
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

async function update(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);
  const [existing] = await pool.query(`SELECT id FROM ${TABLE} WHERE id = ?`, [id]);
  if (existing.length === 0) {
    return res.status(404).json({ message: "Elevador não encontrado" });
  }

  const nome = req.body?.nome !== undefined ? String(req.body.nome).trim() : null;
  const empresaId = req.body?.empresa_id !== undefined ? Number(req.body.empresa_id) : null;

  if (nome !== null && !nome) {
    return res.status(400).json({ message: "nome não pode ser vazio" });
  }
  if (empresaId !== null && (Number.isNaN(empresaId) || empresaId <= 0)) {
    return res.status(400).json({ message: "empresa_id inválido" });
  }
  if (empresaId !== null) {
    const [empresaRows] = await pool.query("SELECT id FROM empresas WHERE id = ?", [empresaId]);
    if (empresaRows.length === 0) {
      return res.status(400).json({ message: "empresa_id inválido" });
    }
  }

  const updates = [];
  const params = [];
  if (nome !== null) {
    updates.push("nome = ?");
    params.push(nome);
  }
  if (empresaId !== null) {
    updates.push("empresa_id = ?");
    params.push(empresaId);
  }
  if (updates.length > 0) {
    params.push(id);
    await pool.query(`UPDATE ${TABLE} SET ${updates.join(", ")} WHERE id = ?`, params);
  }

  const [rows] = await pool.query(
    `SELECT e.id, e.nome, e.empresa_id, e.created_at, e.updated_at,
            emp.nome_fantasia AS empresa_nome_fantasia,
            emp.razao_social AS empresa_razao_social
     FROM ${TABLE} e
     LEFT JOIN empresas emp ON emp.id = e.empresa_id
     WHERE e.id = ?`,
    [id]
  );
  const row = rows[0];
  res.json({
    id: row.id,
    nome: row.nome,
    empresa_id: row.empresa_id,
    empresa_nome: row.empresa_nome_fantasia || row.empresa_razao_social || null,
    empresa: row.empresa_id
      ? {
          id: row.empresa_id,
          nome_fantasia: row.empresa_nome_fantasia,
          razao_social: row.empresa_razao_social,
        }
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

async function remove(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);
  const [existing] = await pool.query(`SELECT id FROM ${TABLE} WHERE id = ?`, [id]);
  if (existing.length === 0) {
    return res.status(404).json({ message: "Elevador não encontrado" });
  }

  const [hasColumn] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE table_schema = DATABASE() AND table_name = 'orcamentos' AND column_name = 'elevador_id'`
  );
  if (Number(hasColumn[0]?.cnt || 0) > 0) {
    const [vinculados] = await pool.query(
      "SELECT id FROM orcamentos WHERE elevador_id = ? LIMIT 1",
      [id]
    );
    if (vinculados.length > 0) {
      return res.status(409).json({
        message:
          "Não é possível excluir o elevador pois existem orçamentos vinculados a ele no pátio.",
      });
    }
  }

  await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  res.status(204).send();
}

export { list, getById, create, update, remove };
