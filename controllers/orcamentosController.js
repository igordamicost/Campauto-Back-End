import * as baseService from "../services/baseService.js";
import { getPool } from "../db.js";

const TABLE = "orcamentos";

function calcularTotais(jsonItens, desconto = 0) {
  if (!jsonItens || !Array.isArray(jsonItens)) {
    return { subtotal: 0, desconto: 0, total: 0 };
  }

  const subtotal = jsonItens.reduce((sum, item) => {
    const total = parseFloat(item?.total) || 0;
    return sum + total;
  }, 0);

  const descontoValue = parseFloat(desconto) || 0;
  const total = subtotal - descontoValue;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    desconto: parseFloat(descontoValue.toFixed(2)),
    total: parseFloat(total.toFixed(2))
  };
}

async function getProximoNumeroSequencial() {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT COALESCE(MAX(numero_sequencial), 0) + 1 AS proximo FROM orcamentos"
  );
  return rows[0]?.proximo || 1;
}

const STATUS_VALIDOS = [
  "Cotação",
  "Aprovado",
  "Separado",
  "Faturado",
  "Cancelado"
];

function normalizeJsonItens(jsonItens) {
  if (jsonItens === undefined || jsonItens === null || jsonItens === "") {
    return { parsed: null, error: null };
  }

  if (Array.isArray(jsonItens)) {
    return { parsed: jsonItens, error: null };
  }

  if (typeof jsonItens === "string") {
    try {
      const parsed = JSON.parse(jsonItens);
      if (!Array.isArray(parsed)) {
        return { parsed: null, error: "json_itens deve ser array" };
      }
      return { parsed, error: null };
    } catch (error) {
      return { parsed: null, error: "json_itens inválido" };
    }
  }

  return { parsed: null, error: "json_itens deve ser array" };
}

async function tableExists(table) {
  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS cnt
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
    `,
    [table]
  );
  return rows[0]?.cnt > 0;
}

async function clienteExists(clienteId) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT id FROM clientes WHERE id = ? LIMIT 1",
    [Number(clienteId)]
  );
  return rows.length > 0;
}

async function list(req, res) {
  const role = String(req.user?.role || "").toUpperCase();
  const isAdmin = role === "MASTER" || role === "ADMIN";
  const query = { ...req.query };
  if (!isAdmin && req.user?.userId) {
    query.usuario_id__eq = req.user.userId;
  }

  const limit = Number(query.limit || query.perPage || 10);
  const page = Math.max(1, Number(query.page || 1));

  const { data, total } = await baseService.listWithFilters(TABLE, query);

  const include = query.include ? String(query.include).split(",") : [];
  const includeClientes = include.includes("clientes");
  const includeEmpresas = include.includes("empresas");
  const includeVeiculos = include.includes("veiculos");

  const pool = getPool();

  const responsavelIds = [
    ...new Set(data.map((row) => row.usuario_id).filter(Boolean))
  ];
  if (responsavelIds.length > 0) {
    const [rows] = await pool.query(
      `SELECT id, name, email, role FROM users WHERE id IN (${responsavelIds
        .map(() => "?")
        .join(",")})`,
      responsavelIds
    );
    const map = new Map(rows.map((row) => [row.id, row]));
    data.forEach((row) => {
      row.responsavel = map.get(row.usuario_id) || null;
    });
  }

  if (includeClientes && data.length > 0) {
    const ids = [...new Set(data.map((row) => row.cliente_id).filter(Boolean))];
    if (ids.length > 0) {
      const [rows] = await pool.query(
        `SELECT id, fantasia, razao_social, email FROM clientes WHERE id IN (${ids
          .map(() => "?")
          .join(",")})`,
        ids
      );
      const map = new Map(
        rows.map((row) => [
          row.id,
          {
            nome: row.fantasia || row.razao_social,
            empresa: row.razao_social,
            email: row.email
          }
        ])
      );
      data.forEach((row) => {
        row.clientes = map.get(row.cliente_id) || null;
      });
    }
  }

  if (includeEmpresas && data.length > 0) {
    const ids = [...new Set(data.map((row) => row.empresa_id).filter(Boolean))];
    if (ids.length > 0) {
      const [rows] = await pool.query(
        `SELECT id, nome_fantasia, razao_social, cnpj FROM empresas WHERE id IN (${ids
          .map(() => "?")
          .join(",")})`,
        ids
      );
      const map = new Map(rows.map((row) => [row.id, row]));
      data.forEach((row) => {
        row.empresas = map.get(row.empresa_id) || null;
      });
    }
  }

  if (includeVeiculos && data.length > 0 && (await tableExists("veiculos"))) {
    const ids = [...new Set(data.map((row) => row.veiculo_id).filter(Boolean))];
    if (ids.length > 0) {
      const [rows] = await pool.query(
        `SELECT * FROM veiculos WHERE id IN (${ids.map(() => "?").join(",")})`,
        ids
      );
      const map = new Map(rows.map((row) => [row.id, row]));
      data.forEach((row) => {
        row.veiculos = map.get(row.veiculo_id) || null;
      });
    }
  }

  const totalPages = Math.ceil(total / limit) || 1;
  res.json({ data, page, perPage: limit, total, totalPages });
}

async function getById(req, res) {
  const pool = getPool();
  const hasVeiculos = await tableExists("veiculos");

  const [rows] = await pool.query(
    `
      SELECT o.*
      FROM orcamentos o
      WHERE o.id = ?
    `,
    [Number(req.params.id)]
  );

  const item = rows[0];
  if (!item) return res.status(404).json({ message: "Not found" });

  const role = String(req.user?.role || "").toUpperCase();
  const isAdmin = role === "MASTER" || role === "ADMIN";
  if (!isAdmin && req.user?.userId && item.usuario_id !== req.user.userId) {
    return res.status(403).json({ message: "Acesso negado" });
  }

  if (item.usuario_id) {
    const [users] = await pool.query(
      "SELECT id, name, email, role FROM users WHERE id = ?",
      [item.usuario_id]
    );
    item.responsavel = users[0] || null;
  } else {
    item.responsavel = null;
  }

  if (item.cliente_id) {
    const [clientes] = await pool.query(
      "SELECT fantasia, razao_social, email FROM clientes WHERE id = ?",
      [item.cliente_id]
    );
    const cliente = clientes[0] || {};
    item.clientes = {
      nome: cliente.fantasia || cliente.razao_social,
      empresa: cliente.razao_social,
      email: cliente.email
    };
  } else {
    item.clientes = null;
  }

  if (item.empresa_id) {
    const [empresas] = await pool.query(
      "SELECT * FROM empresas WHERE id = ?",
      [item.empresa_id]
    );
    item.empresas = empresas[0] || null;
  } else {
    item.empresas = null;
  }

  delete item.cliente_nome;
  delete item.cliente_empresa;
  delete item.cliente_email;
  delete item.empresa_nome;

  if (hasVeiculos && item.veiculo_id) {
    const [veiculos] = await pool.query(
      "SELECT * FROM veiculos WHERE id = ?",
      [item.veiculo_id]
    );
    item.veiculos = veiculos[0] || null;
  }

  res.json(item);
}

async function create(req, res) {
  if (!req.body?.cliente_id) {
    return res.status(400).json({ message: "cliente_id é obrigatório" });
  }

  const clienteOk = await clienteExists(req.body.cliente_id);
  if (!clienteOk) {
    return res.status(400).json({ message: "cliente_id inválido" });
  }

  if (req.body.status && !STATUS_VALIDOS.includes(req.body.status)) {
    return res.status(400).json({ message: "status inválido" });
  }

  const { parsed: jsonItensParsed, error: jsonItensError } = normalizeJsonItens(
    req.body.json_itens
  );
  if (jsonItensError) {
    return res.status(400).json({ message: jsonItensError });
  }

  const numeroSequencial = await getProximoNumeroSequencial();

  const { subtotal, desconto, total } = calcularTotais(
    jsonItensParsed,
    req.body.desconto || 0
  );

  const dados = {
    ...req.body,
    json_itens: jsonItensParsed ? JSON.stringify(jsonItensParsed) : null,
    numero_sequencial: numeroSequencial,
    usuario_id: req.user?.userId || null,
    subtotal,
    desconto,
    total
  };

  const id = await baseService.create(TABLE, dados);
  if (!id) return res.status(409).json({ message: "Duplicate or invalid" });

  res.status(201).json({ id, numero_sequencial: numeroSequencial });
}

async function update(req, res) {
  const dados = { ...req.body };

  const { parsed: jsonItensParsed, error: jsonItensError } = normalizeJsonItens(
    dados.json_itens
  );
  if (jsonItensError) {
    return res.status(400).json({ message: jsonItensError });
  }

  if (jsonItensParsed) {
    const { subtotal, desconto, total } = calcularTotais(
      jsonItensParsed,
      dados.desconto || 0
    );
    dados.subtotal = subtotal;
    dados.desconto = desconto || 0;
    dados.total = total;
    dados.json_itens = JSON.stringify(jsonItensParsed);
  } else if (dados.json_itens !== undefined) {
    dados.json_itens = null;
  }

  const ok = await baseService.update(TABLE, req.params.id, dados);
  if (!ok) return res.status(404).json({ message: "Not found or empty body" });
  res.json({ message: "Updated" });
}

async function updateStatus(req, res) {
  const { status } = req.body || {};
  if (!status) {
    return res.status(400).json({ message: "status é obrigatório" });
  }

  if (!STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ message: "status inválido" });
  }

  const ok = await baseService.update(TABLE, req.params.id, { status });
  if (!ok) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Status updated" });
}

async function remove(req, res) {
  const ok = await baseService.remove(TABLE, req.params.id);
  if (!ok) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted" });
}

export { list, getById, create, update, updateStatus, remove };
