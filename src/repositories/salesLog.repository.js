import { db } from "../config/database.js";

/**
 * Repositório para Sales Log (histórico de vendas e intenções)
 */
export class SalesLogRepository {
  static async list(filters = {}) {
    const {
      page = 1,
      limit = 50,
      data_inicio,
      data_fim,
      empresa_id,
      vendedor_id,
      cliente_id,
      veiculo_id,
      produto_id,
      tipo,
      orcamento_id,
    } = filters;

    const whereParts = [];
    const params = [];

    if (data_inicio) {
      whereParts.push("sl.created_at >= ?");
      params.push(data_inicio);
    }
    if (data_fim) {
      whereParts.push("sl.created_at <= ?");
      params.push(data_fim);
    }
    if (empresa_id) {
      whereParts.push("sl.empresa_id = ?");
      params.push(Number(empresa_id));
    }
    if (vendedor_id) {
      whereParts.push("sl.vendedor_id = ?");
      params.push(Number(vendedor_id));
    }
    if (cliente_id) {
      whereParts.push("sl.cliente_id = ?");
      params.push(Number(cliente_id));
    }
    if (veiculo_id) {
      whereParts.push("sl.veiculo_id = ?");
      params.push(Number(veiculo_id));
    }
    if (produto_id) {
      whereParts.push("sl.produto_id = ?");
      params.push(Number(produto_id));
    }
    if (tipo) {
      whereParts.push("sl.tipo = ?");
      params.push(tipo);
    }
    if (orcamento_id) {
      whereParts.push("sl.orcamento_id = ?");
      params.push(Number(orcamento_id));
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const offset = (Math.max(1, Number(page)) - 1) * Math.min(200, Number(limit) || 50);
    const limitNum = Math.min(200, Number(limit) || 50);

    const [rows] = await db.query(
      `SELECT sl.*,
              p.descricao AS produto_nome, p.codigo_produto AS produto_codigo,
              e.nome_fantasia AS empresa_nome,
              u.name AS vendedor_nome,
              c.fantasia AS cliente_nome,
              v.placa AS veiculo_placa,
              o.numero_sequencial AS orcamento_numero
       FROM sales_log sl
       LEFT JOIN produtos p ON sl.produto_id = p.id
       LEFT JOIN empresas e ON sl.empresa_id = e.id
       LEFT JOIN users u ON sl.vendedor_id = u.id
       LEFT JOIN clientes c ON sl.cliente_id = c.id
       LEFT JOIN veiculos v ON sl.veiculo_id = v.id
       LEFT JOIN orcamentos o ON sl.orcamento_id = o.id
       ${whereSql}
       ORDER BY sl.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM sales_log sl ${whereSql}`,
      params
    );

    return { data: rows, total: countRow?.total ?? 0 };
  }

  static async create(data) {
    const {
      tipo,
      orcamento_id,
      produto_id,
      empresa_id,
      vendedor_id,
      cliente_id,
      veiculo_id,
      valor,
      quantidade,
      origem_item,
    } = data;

    const [result] = await db.query(
      `INSERT INTO sales_log (tipo, orcamento_id, produto_id, empresa_id, vendedor_id, cliente_id, veiculo_id, valor, quantidade, origem_item)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tipo,
        orcamento_id || null,
        produto_id || null,
        empresa_id || null,
        vendedor_id || null,
        cliente_id || null,
        veiculo_id || null,
        valor || null,
        quantidade || null,
        origem_item || null,
      ]
    );
    return result.insertId;
  }
}
