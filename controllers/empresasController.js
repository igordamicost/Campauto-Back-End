import * as baseService from "../services/baseService.js";

const TABLE = "empresas";

function normalizeLogoFromBody(body = {}) {
  const normalized = { ...body };

  // Aceita tanto logo_base64 direto quanto logo: { base64: "..." }
  if (body.logo && typeof body.logo === "object") {
    const base64 = body.logo.base64 || body.logo.data || null;
    if (base64) {
      normalized.logo_base64 = base64;
    } else if (body.logo === null) {
      normalized.logo_base64 = null;
    }
    delete normalized.logo;
  }

  return normalized;
}

function attachLogoToResponseRow(row) {
  if (!row) return row;
  const cloned = { ...row };

  if (cloned.logo_base64) {
    cloned.logo = { base64: cloned.logo_base64 };
  } else {
    cloned.logo = null;
  }

  return cloned;
}

async function list(req, res) {
  const limit = Number(req.query.limit || req.query.perPage || 10);
  const page = Math.max(1, Number(req.query.page || 1));
  const { data, total } = await baseService.listWithFilters(TABLE, req.query);
  const totalPages = Math.ceil(total / limit) || 1;

  const mapped = Array.isArray(data)
    ? data.map((row) => attachLogoToResponseRow(row))
    : [];

  res.json({ data: mapped, page, perPage: limit, total, totalPages });
}

async function getById(req, res) {
  const item = await baseService.getById(TABLE, req.params.id);
  if (!item) return res.status(404).json({ message: "Not found" });
  res.json(attachLogoToResponseRow(item));
}

async function create(req, res) {
  if (!req.body?.nome_fantasia) {
    return res.status(400).json({ message: "nome_fantasia é obrigatório" });
  }

  const payload = normalizeLogoFromBody(req.body || {});

  const id = await baseService.create(TABLE, payload);
  if (!id) return res.status(409).json({ message: "Duplicate or invalid" });
  res.status(201).json({ id });
}

async function update(req, res) {
  const payload = normalizeLogoFromBody(req.body || {});
  const ok = await baseService.update(TABLE, req.params.id, payload);
  if (!ok) return res.status(404).json({ message: "Not found or empty body" });
  res.json({ message: "Updated" });
}

async function remove(req, res) {
  const ok = await baseService.remove(TABLE, req.params.id);
  if (!ok) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted" });
}

export { list, getById, create, update, remove };
