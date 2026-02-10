import { getPool } from "../db.js";

async function orcamentos(req, res) {
  const { data_inicio, data_fim, status } = req.query;
  const pool = getPool();

  let sql = `
    SELECT 
      o.*,
      c.fantasia AS cliente_nome,
      c.razao_social AS cliente_empresa
    FROM orcamentos o
    LEFT JOIN clientes c ON o.cliente_id = c.id
  `;
  const params = [];
  const where = [];

  if (data_inicio && data_fim) {
    where.push("o.data BETWEEN ? AND ?");
    params.push(data_inicio, data_fim);
  }

  if (status) {
    where.push("o.status = ?");
    params.push(status);
  }

  if (where.length > 0) {
    sql += ` WHERE ${where.join(" AND ")}`;
  }

  sql += " ORDER BY o.data DESC, o.id DESC";

  const [rows] = await pool.query(sql, params);

  const data = rows.map((row) => {
    const item = { ...row };
    item.clientes = {
      nome: row.cliente_nome,
      empresa: row.cliente_empresa
    };
    delete item.cliente_nome;
    delete item.cliente_empresa;
    return item;
  });

  res.json({ data });
}

export { orcamentos };
