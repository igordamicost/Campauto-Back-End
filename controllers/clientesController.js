import * as baseService from "../services/baseService.js";

const TABLE = 'clientes';

async function list(req, res) {
  const limit = Number(req.query.limit || req.query.perPage || 10);
  const page = Math.max(1, Number(req.query.page || 1));
  const offset = (page - 1) * limit;
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

export { list, getById, create, update, remove };
