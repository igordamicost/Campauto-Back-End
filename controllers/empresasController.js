import * as baseService from "../services/baseService.js";
import { executarVerificacaoFiscalEmpresas } from "../src/services/empresasFiscalCheckJob.service.js";
import { FocusNfRepository } from "../src/repositories/focusNf.repository.js";

const TABLE = "empresas";

function dispararJobVerificacaoFiscal() {
  executarVerificacaoFiscalEmpresas().catch((err) => {
    console.error("[empresasFiscalCheckJob] Erro ao verificar empresas:", err?.message || err);
  });
}

function normalizeLogoFromBody(body = {}) {
  const normalized = { ...body };

  // Aceita logo_url direto ou logo: { url: "..." }
  if (body.logo !== undefined) {
    if (body.logo && typeof body.logo === "object") {
      const url = body.logo.url || null;
      normalized.logo_url = url && typeof url === "string" ? url.trim() || null : null;
    } else if (body.logo === null) {
      normalized.logo_url = null;
    }
    delete normalized.logo;
  }
  if (typeof body.logo_url === "string") {
    normalized.logo_url = body.logo_url.trim() || null;
  }

  return normalized;
}

function attachLogoToResponseRow(row) {
  if (!row) return row;
  const cloned = { ...row };

  if (cloned.logo_url) {
    cloned.logo = { url: cloned.logo_url };
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

  let mapped = Array.isArray(data) ? data.map((row) => attachLogoToResponseRow(row)) : [];

  if (mapped.length > 0) {
    const ids = mapped.map((r) => r.id).filter(Boolean);
    const statusMap = await FocusNfRepository.getConfiguracaoFiscalStatusByEmpresaIds(ids);
    mapped = mapped.map((r) => ({
      ...r,
      configuracao_fiscal_ok: statusMap[r.id] ?? false,
      configuracao_fiscal_pendente: !(statusMap[r.id] ?? false),
    }));
  }

  res.json({ data: mapped, page, perPage: limit, total, totalPages });
}

async function getById(req, res) {
  const item = await baseService.getById(TABLE, req.params.id);
  if (!item) return res.status(404).json({ message: "Not found" });
  const out = attachLogoToResponseRow(item);
  const fiscalOk = await FocusNfRepository.isConfiguracaoFiscalOk(Number(req.params.id));
  out.configuracao_fiscal_ok = fiscalOk;
  out.configuracao_fiscal_pendente = !fiscalOk;
  res.json(out);
}

async function create(req, res) {
  if (!req.body?.nome_fantasia) {
    return res.status(400).json({ message: "nome_fantasia é obrigatório" });
  }

  const payload = normalizeLogoFromBody(req.body || {});

  const id = await baseService.create(TABLE, payload);
  if (!id) return res.status(409).json({ message: "Duplicate or invalid" });
  dispararJobVerificacaoFiscal();

  const created = await baseService.getById(TABLE, id);
  const out = created ? attachLogoToResponseRow(created) : { id };
  res.status(201).json(out);
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
  dispararJobVerificacaoFiscal();
  res.json({ message: "Deleted" });
}

export { list, getById, create, update, remove };
