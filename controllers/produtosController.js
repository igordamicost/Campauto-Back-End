import * as baseService from "../services/baseService.js";
import {
  listProdutosWithSearch,
  listCorrelatos,
} from "../services/produtosSearchService.js";

const TABLE = "produtos";

async function list(req, res) {
  const limit = Math.max(1, Math.min(1000, Number(req.query.limit || req.query.perPage) || 20));
  const page = Math.max(1, Number(req.query.page || 1));
  const q = req.query.q ? String(req.query.q).trim() : "";
  const observacao =
    req.query.observacao !== undefined && req.query.observacao !== null
      ? String(req.query.observacao).trim()
      : undefined;
  const observacaoId =
    req.query.observacao_id !== undefined && req.query.observacao_id !== null && req.query.observacao_id !== ""
      ? Number(req.query.observacao_id)
      : undefined;

  const useSearch =
    q.length > 0 ||
    (observacao !== undefined && observacao !== "") ||
    observacaoId !== undefined;

  if (useSearch) {
    const { data, total } = await listProdutosWithSearch({
      q: q || undefined,
      observacao,
      observacao_id: observacaoId,
      limit,
      page,
      sortBy: req.query.sortBy,
      sortDir: req.query.sortDir,
    });
    const totalPages = Math.ceil(total / limit) || 1;
    return res.json({
      data,
      page,
      perPage: limit,
      total,
      totalPages,
    });
  }

  const { data, total } = await baseService.listWithFilters(TABLE, req.query);
  const totalPages = Math.ceil(total / limit) || 1;
  res.json({ data, page, perPage: limit, total, totalPages });
}

async function getById(req, res) {
  const item = await baseService.getById(TABLE, req.params.id);
  if (!item) return res.status(404).json({ message: 'Not found' });
  res.json(item);
}

async function create(req, res) {
  const id = await baseService.create(TABLE, req.body || {});
  if (!id) return res.status(409).json({ message: 'Duplicate or invalid' });
  res.status(201).json({ id });
}

async function update(req, res) {
  const ok = await baseService.update(TABLE, req.params.id, req.body || {});
  if (!ok) return res.status(404).json({ message: 'Not found or empty body' });
  res.json({ message: 'Updated' });
}

async function remove(req, res) {
  const ok = await baseService.remove(TABLE, req.params.id);
  if (!ok) return res.status(404).json({ message: 'Not found' });
  res.json({ message: 'Deleted' });
}

async function correlatos(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid product id' });

  const result = await listCorrelatos(id, {
    limit: req.query.limit || req.query.perPage,
    page: req.query.page,
    sortBy: req.query.sortBy,
    sortDir: req.query.sortDir,
  });

  if (result === null) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const limit = Math.max(1, Math.min(1000, Number(req.query.limit || req.query.perPage) || 50));
  const page = Math.max(1, Number(req.query.page || 1));
  const totalPages = Math.ceil(result.total / limit) || 1;

  return res.json({
    data: result.data,
    total: result.total,
    page,
    perPage: limit,
    totalPages,
  });
}

export { list, getById, create, update, remove, correlatos };
