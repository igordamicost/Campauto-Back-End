import * as baseService from "../services/baseService.js";
import { getPool } from "../db.js";

const TABLE = "fornecedores";

async function list(req, res) {
  const query = { ...req.query };
  const limit = Number(query.limit || query.perPage || 20);
  const page = Math.max(1, Number(query.page || 1));

  const { data, total } = await baseService.listWithFilters(TABLE, query);

  const totalPages = Math.ceil(total / limit) || 1;
  res.json({
    data,
    page,
    perPage: limit,
    total,
    totalPages,
  });
}

async function getById(req, res) {
  const item = await baseService.getById(TABLE, req.params.id);
  if (!item) {
    return res.status(404).json({ message: "Fornecedor não encontrado" });
  }
  res.json(item);
}

async function create(req, res) {
  const now = new Date();
  const payload = {
    nome_fantasia: req.body.nome_fantasia ?? req.body.fantasia ?? null,
    razao_social: req.body.razao_social ?? null,
    cnpj: req.body.cnpj ?? null,
    endereco: req.body.endereco ?? req.body.endereço ?? null,
    telefone: req.body.telefone ?? null,
    email: req.body.email ?? null,
    responsavel: req.body.responsavel ?? null,
    created_at: now,
    updated_at: now,
  };

  const id = await baseService.create(TABLE, payload);
  if (!id) {
    return res.status(409).json({ message: "Duplicate or invalid" });
  }

  const created = await baseService.getById(TABLE, id);
  res.status(201).json(created);
}

async function update(req, res) {
  const payload = {};
  const allowed = [
    "nome_fantasia",
    "fantasia",
    "razao_social",
    "cnpj",
    "endereco",
    "endereço",
    "telefone",
    "email",
    "responsavel",
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      const col = key === "endereço" ? "endereco" : key === "fantasia" ? "nome_fantasia" : key;
      payload[col] = req.body[key];
    }
  }

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ message: "Nenhum campo para atualizar" });
  }

  const ok = await baseService.update(TABLE, req.params.id, payload);
  if (!ok) {
    return res.status(404).json({ message: "Fornecedor não encontrado" });
  }

  const updated = await baseService.getById(TABLE, req.params.id);
  res.json(updated);
}

async function remove(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);

  const [fornecedorRows] = await pool.query(
    "SELECT id FROM fornecedores WHERE id = ?",
    [id]
  );
  if (fornecedorRows.length === 0) {
    return res.status(404).json({ message: "Fornecedor não encontrado" });
  }

  const [comprasRows] = await pool.query(
    "SELECT id FROM compras WHERE fornecedor_id = ? LIMIT 1",
    [id]
  );
  if (comprasRows.length > 0) {
    return res.status(409).json({
      message:
        "Não é possível excluir o fornecedor pois existem compras vinculadas. Remova ou altere as compras primeiro.",
    });
  }

  const ok = await baseService.remove(TABLE, req.params.id);
  if (!ok) {
    return res.status(404).json({ message: "Fornecedor não encontrado" });
  }
  res.status(204).send();
}

export { list, getById, create, update, remove };
