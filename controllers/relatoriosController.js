import { getPool } from "../db.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(str) {
  if (!str || typeof str !== "string") return false;
  if (!DATE_REGEX.test(str)) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

function normalizeJsonItens(jsonItens) {
  if (jsonItens === undefined || jsonItens === null || jsonItens === "") {
    return [];
  }
  let arr = jsonItens;
  if (typeof jsonItens === "string") {
    try {
      arr = JSON.parse(jsonItens);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];

  return arr.map((item, idx) => {
    const qty = Number(item?.quantidade) || 0;
    const unit = Number(item?.valor_unitario) || 0;
    const total = Number(item?.total) ?? qty * unit;

    return {
      id: Number(item?.id) || idx + 1,
      produto_id: Number(item?.produto_id) || 0,
      quantidade: qty,
      valor_unitario: unit,
      total: Math.round(total * 100) / 100,
    };
  });
}

async function orcamentos(req, res) {
  const { data_inicio, data_fim, status } = req.query;

  if (data_inicio && !isValidDate(data_inicio)) {
    return res.status(400).json({
      message: "Formato de data inválido. Use YYYY-MM-DD",
      field: "data_inicio",
    });
  }
  if (data_fim && !isValidDate(data_fim)) {
    return res.status(400).json({
      message: "Formato de data inválido. Use YYYY-MM-DD",
      field: "data_fim",
    });
  }

  const pool = getPool();
  const where = [];
  const params = [];

  if (data_inicio) {
    where.push("o.data >= ?");
    params.push(data_inicio);
  }
  if (data_fim) {
    where.push("o.data <= ?");
    params.push(data_fim);
  }
  if (status) {
    where.push("o.status = ?");
    params.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      o.id,
      o.numero_sequencial,
      o.data,
      o.status,
      o.json_itens,
      c.id AS cliente_id,
      c.cliente AS cliente_nome,
      c.fantasia AS cliente_fantasia,
      c.razao_social AS cliente_empresa
    FROM orcamentos o
    LEFT JOIN clientes c ON o.cliente_id = c.id
    ${whereSql}
    ORDER BY o.data DESC, o.numero_sequencial DESC
  `;

  let rows;
  try {
    [rows] = await pool.query(sql, params);
  } catch (err) {
    console.error("Relatório orçamentos:", err);
    return res.status(500).json({ message: "Erro ao processar relatório" });
  }

  const data = rows.map((row) => {
    const jsonItens = normalizeJsonItens(row.json_itens);
    const dataStr =
      row.data instanceof Date
        ? row.data.toISOString().slice(0, 10)
        : String(row.data || "").slice(0, 10);

    const item = {
      id: row.id,
      numero_sequencial: row.numero_sequencial,
      data: dataStr,
      status: row.status || "Cotação",
      json_itens: jsonItens,
    };

    if (row.cliente_id) {
      item.clientes = {
        id: row.cliente_id,
        nome: row.cliente_nome || null,
        fantasia: row.cliente_fantasia || null,
        empresa: row.cliente_empresa || null,
      };
    } else {
      item.clientes = null;
    }

    return item;
  });

  res.json({ data });
}

export { orcamentos };
