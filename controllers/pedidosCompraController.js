import * as baseService from "../services/baseService.js";
import { getPool } from "../db.js";
import { RBACRepository } from "../src/repositories/rbac.repository.js";
import { getTemplate, renderWithData } from "../src/services/templateService.js";
import { sendEmailWithInlineLogo, buildCompanyHeaderHtml } from "../src/services/email.service.js";
import { loadLogo } from "../src/services/logoLoader.js";
import { renderTemplate } from "../src/services/templateRenderService.js";
import { logSupplierOrderEmail } from "../src/services/emailLogService.js";

const TABLE = "pedidos_compra";

const STATUS_VALIDOS = ["Pendente", "Enviado", "Cotado", "Recebido", "Cancelado"];
const STATUS_PODE_EXCLUIR = ["Pendente", "Cancelado"];

async function getProximoNumeroSequencial() {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT COALESCE(MAX(numero_sequencial), 0) + 1 AS proximo FROM pedidos_compra"
  );
  return rows[0]?.proximo || 1;
}

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
      if (!Array.isArray(parsed)) return { parsed: null, error: "json_itens deve ser array" };
      return { parsed, error: null };
    } catch {
      return { parsed: null, error: "json_itens inválido" };
    }
  }
  return { parsed: null, error: "json_itens deve ser array" };
}

function validarItem(item) {
  if (!item || typeof item !== "object") return "Item inválido";
  if (item.produto_id == null && item.produto === undefined) return "Cada item deve ter produto_id ou produto (descrição)";
  if (item.quantidade == null || Number(item.quantidade) <= 0) return "Cada item deve ter quantidade > 0";
  const qtd = Number(item.quantidade);
  const preco = Number(item.preco_unitario ?? item.preco_custo ?? 0) || 0;
  if (item.total == null || item.total === "") {
    item.total = (qtd * preco).toFixed(2);
  }
  return null;
}

function buildTabelaItensHtml(jsonItens) {
  if (!jsonItens || !Array.isArray(jsonItens) || jsonItens.length === 0) {
    return "<p>Nenhum item.</p>";
  }
  const rows = jsonItens.map(
    (it) =>
      `<tr>
        <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(it.codigo_produto || it.produto_id || "-")}</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(it.produto || it.descricao || "-")}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${Number(it.quantidade) || 0}</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(it.unidade || "UN")}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${formatMoney(it.preco_unitario ?? it.preco_custo)}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${formatMoney(it.total)}</td>
      </tr>`
  ).join("");
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:12px 0">
      <thead>
        <tr style="background:#f3f4f6">
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Código</th>
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Descrição</th>
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">Qtd</th>
          <th style="padding:8px;border:1px solid #e5e7eb">Un</th>
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">Preço unit.</th>
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(val) {
  if (val == null || val === "") return "-";
  const n = Number(val);
  if (Number.isNaN(n)) return "-";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


async function list(req, res) {
  const canSeeAll = await RBACRepository.userHasPermission(req.user?.userId, "admin.read");
  const query = { ...req.query };
  if (!canSeeAll && req.user?.userId) {
    query.usuario_id__eq = req.user.userId;
  }

  const limit = Number(query.limit || query.perPage || 20);
  const page = Math.max(1, Number(query.page || 1));
  const { data, total } = await baseService.listWithFilters(TABLE, query);
  const totalPages = Math.ceil(total / limit) || 1;

  const include = query.include ? String(query.include).split(",").map((s) => s.trim()) : [];
  const includeEmpresas = include.includes("empresas");

  const pool = getPool();
  const usuarioIds = [...new Set(data.map((r) => r.usuario_id).filter(Boolean))];
  let usuarioMap = new Map();
  if (usuarioIds.length > 0) {
    const [rows] = await pool.query(
      `SELECT id, name, email FROM users WHERE id IN (${usuarioIds.map(() => "?").join(",")})`,
      usuarioIds
    );
    usuarioMap = new Map(rows.map((r) => [r.id, r]));
  }

  let empresaMap = new Map();
  if (includeEmpresas && data.length > 0) {
    const empresaIds = [...new Set(data.map((r) => r.empresa_id).filter(Boolean))];
    if (empresaIds.length > 0) {
      const [empRows] = await pool.query(
        `SELECT id, nome_fantasia, razao_social, cnpj FROM empresas WHERE id IN (${empresaIds.map(() => "?").join(",")})`,
        empresaIds
      );
      empresaMap = new Map(empRows.map((e) => [e.id, e]));
    }
  }

  const orcamentoIds = [...new Set(data.map((r) => r.orcamento_id).filter(Boolean))];
  let orcamentoMap = new Map();
  if (orcamentoIds.length > 0) {
    const [orcRows] = await pool.query(
      `SELECT id, numero_sequencial FROM orcamentos WHERE id IN (${orcamentoIds.map(() => "?").join(",")})`,
      orcamentoIds
    );
    orcamentoMap = new Map(orcRows.map((o) => [o.id, o.numero_sequencial]));
  }

  const mapped = data.map((row) => {
    const u = usuarioMap.get(row.usuario_id);
    const out = {
      ...row,
      usuario: u ? { id: u.id, name: u.name, email: u.email } : null,
      orcamento_numero: row.orcamento_id ? (orcamentoMap.get(row.orcamento_id) ?? null) : null,
    };
    if (includeEmpresas) {
      out.empresas = row.empresa_id ? (empresaMap.get(row.empresa_id) || null) : null;
    }
    return out;
  });

  res.json({ data: mapped, page, perPage: limit, total, totalPages });
}

async function getById(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "ID inválido" });

  const item = await baseService.getById(TABLE, id);
  if (!item) return res.status(404).json({ message: "Not found" });

  const canSeeAll = await RBACRepository.userHasPermission(req.user?.userId, "admin.read");
  if (!canSeeAll && req.user?.userId && item.usuario_id !== req.user.userId) {
    return res.status(404).json({ message: "Not found" });
  }

  const pool = getPool();
  const [userRows] = await pool.query(
    "SELECT id, name, email FROM users WHERE id = ?",
    [item.usuario_id]
  );
  item.usuario = userRows[0] || null;

  if (item.empresa_id) {
    const [empRows] = await pool.query(
      "SELECT id, nome_fantasia, razao_social, cnpj FROM empresas WHERE id = ?",
      [item.empresa_id]
    );
    item.empresas = empRows[0] || null;
  }

  if (item.orcamento_id) {
    const [orcRows] = await pool.query(
      "SELECT id, numero_sequencial FROM orcamentos WHERE id = ?",
      [item.orcamento_id]
    );
    item.orcamento_numero = orcRows[0]?.numero_sequencial ?? null;
  } else {
    item.orcamento_numero = null;
  }

  if (item.json_itens && typeof item.json_itens === "string") {
    try {
      item.json_itens = JSON.parse(item.json_itens);
    } catch {
      item.json_itens = [];
    }
  }

  res.json(item);
}

async function create(req, res) {
  const { empresa_id, data: dataPedido, observacoes, json_itens, orcamento_id } = req.body || {};

  const empresaId = empresa_id != null ? Number(empresa_id) : null;
  if (!empresaId) {
    return res.status(400).json({ message: "empresa_id é obrigatório" });
  }

  const pool = getPool();
  const [empRows] = await pool.query("SELECT id FROM empresas WHERE id = ?", [empresaId]);
  if (!empRows || empRows.length === 0) {
    return res.status(400).json({ message: "empresa_id inválido: empresa não encontrada" });
  }

  const orcamentoId = orcamento_id != null ? Number(orcamento_id) : null;
  if (orcamentoId != null && orcamentoId > 0) {
    const [orcRows] = await pool.query("SELECT id FROM orcamentos WHERE id = ?", [orcamentoId]);
    if (!orcRows || orcRows.length === 0) {
      return res.status(400).json({ message: "orcamento_id inválido: orçamento não encontrado" });
    }
  }

  const { parsed: itens, error: errItens } = normalizeJsonItens(json_itens);
  if (errItens) return res.status(400).json({ message: errItens });
  if (!itens || itens.length === 0) {
    return res.status(400).json({ message: "json_itens é obrigatório e deve ser array não vazio" });
  }

  for (const item of itens) {
    const err = validarItem(item);
    if (err) return res.status(400).json({ message: err });
  }

  const dataStr = dataPedido || new Date().toISOString().slice(0, 10);
  const numeroSequencial = await getProximoNumeroSequencial();
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: "Não autenticado" });

  const payload = {
    data: dataStr,
    status: "Pendente",
    json_itens: JSON.stringify(itens),
    observacoes: observacoes || null,
    usuario_id: userId,
    empresa_id: empresaId,
    numero_sequencial: numeroSequencial,
  };
  if (orcamentoId != null) payload.orcamento_id = orcamentoId;

  const id = await baseService.create(TABLE, payload);
  if (!id) return res.status(409).json({ message: "Erro ao criar pedido" });

  res.status(201).json({ id, numero_sequencial: numeroSequencial });
}

async function update(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "ID inválido" });

  const item = await baseService.getById(TABLE, id);
  if (!item) return res.status(404).json({ message: "Not found" });

  const canSeeAll = await RBACRepository.userHasPermission(req.user?.userId, "admin.read");
  if (!canSeeAll && req.user?.userId && item.usuario_id !== req.user.userId) {
    return res.status(404).json({ message: "Not found" });
  }

  const { empresa_id, data: dataPedido, observacoes, json_itens, status, orcamento_id } = req.body || {};
  const payload = {};

  if (orcamento_id !== undefined) {
    const orcId = orcamento_id != null ? Number(orcamento_id) : null;
    if (orcId != null && orcId > 0) {
      const poolUpd = getPool();
      const [orcRows] = await poolUpd.query("SELECT id FROM orcamentos WHERE id = ?", [orcId]);
      if (!orcRows || orcRows.length === 0) {
        return res.status(400).json({ message: "orcamento_id inválido: orçamento não encontrado" });
      }
    }
    payload.orcamento_id = orcId;
  }
  if (empresa_id !== undefined) {
    const empresaId = empresa_id != null ? Number(empresa_id) : null;
    if (!empresaId) {
      return res.status(400).json({ message: "empresa_id é obrigatório" });
    }
    const poolUpd = getPool();
    const [empRows] = await poolUpd.query("SELECT id FROM empresas WHERE id = ?", [empresaId]);
    if (!empRows || empRows.length === 0) {
      return res.status(400).json({ message: "empresa_id inválido: empresa não encontrada" });
    }
    payload.empresa_id = empresaId;
  }

  if (dataPedido !== undefined) payload.data = dataPedido;
  if (observacoes !== undefined) payload.observacoes = observacoes;
  if (status !== undefined) {
    if (!STATUS_VALIDOS.includes(status)) {
      return res.status(400).json({ message: `status inválido. Use: ${STATUS_VALIDOS.join(", ")}` });
    }
    payload.status = status;
  }
  if (json_itens !== undefined) {
    const { parsed: itens, error: errItens } = normalizeJsonItens(json_itens);
    if (errItens) return res.status(400).json({ message: errItens });
    if (itens && itens.length > 0) {
      for (const it of itens) {
        const err = validarItem(it);
        if (err) return res.status(400).json({ message: err });
      }
      payload.json_itens = JSON.stringify(itens);
    }
  }

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ message: "Nenhum campo para atualizar" });
  }

  const ok = await baseService.update(TABLE, id, payload);
  if (!ok) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Updated" });
}

async function remove(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "ID inválido" });

  const item = await baseService.getById(TABLE, id);
  if (!item) return res.status(404).json({ message: "Not found" });

  const canSeeAll = await RBACRepository.userHasPermission(req.user?.userId, "admin.read");
  if (!canSeeAll && req.user?.userId && item.usuario_id !== req.user.userId) {
    return res.status(404).json({ message: "Not found" });
  }

  if (!STATUS_PODE_EXCLUIR.includes(item.status)) {
    return res.status(409).json({
      message: `Pedido com status "${item.status}" não pode ser excluído. Apenas Pendente ou Cancelado.`,
    });
  }

  const ok = await baseService.remove(TABLE, id);
  if (!ok) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted" });
}

async function updateStatus(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "ID inválido" });

  const item = await baseService.getById(TABLE, id);
  if (!item) return res.status(404).json({ message: "Not found" });

  const canSeeAll = await RBACRepository.userHasPermission(req.user?.userId, "admin.read");
  if (!canSeeAll && req.user?.userId && item.usuario_id !== req.user.userId) {
    return res.status(404).json({ message: "Not found" });
  }

  const { status } = req.body || {};
  if (!status || !STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ message: `status inválido. Use: ${STATUS_VALIDOS.join(", ")}` });
  }

  const ok = await baseService.update(TABLE, id, { status });
  if (!ok) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Status atualizado", status });
}

function parseFornecedorIds(val) {
  if (Array.isArray(val)) return val;
  if (val == null || val === "") return null;
  const str = String(val).trim();
  if (!str) return null;
  try {
    const parsed = JSON.parse(str);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((x) => Number(x)).filter((n) => !Number.isNaN(n) && n > 0);
  } catch {
    return null;
  }
}

async function enviarFornecedores(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "ID inválido" });

  const fornecedorIds = parseFornecedorIds(req.body?.fornecedor_ids);
  if (!fornecedorIds || fornecedorIds.length === 0) {
    return res.status(400).json({
      message: "fornecedor_ids é obrigatório (JSON string, ex: \"[1, 2, 3]\") e deve conter ao menos um ID válido",
    });
  }

  const pdfFile = req.file;
  const pdfAttachment = pdfFile?.buffer
    ? {
        filename: pdfFile.originalname || `Pedido_${id}.pdf`,
        content: pdfFile.buffer,
        contentType: pdfFile.mimetype || "application/pdf",
      }
    : null;

  const pool = getPool();
  const [pedidoRows] = await pool.query(
    "SELECT * FROM pedidos_compra WHERE id = ?",
    [id]
  );
  const pedido = pedidoRows[0];
  if (!pedido) return res.status(404).json({ message: "Pedido não encontrado" });

  const canSeeAll = await RBACRepository.userHasPermission(req.user?.userId, "admin.read");
  if (!canSeeAll && req.user?.userId && pedido.usuario_id !== req.user.userId) {
    return res.status(404).json({ message: "Not found" });
  }

  const [fornecedoresRows] = await pool.query(
    `SELECT id, nome_fantasia, razao_social, email FROM fornecedores WHERE id IN (${fornecedorIds.map(() => "?").join(",")})`,
    fornecedorIds
  );

  const enviados = [];
  const erros = [];

  let companyName = process.env.COMPANY_NAME || "Campauto";
  const empresaId = pedido.empresa_id || req.user?.empresaId;
  let logoUrl = null;
  if (empresaId) {
    const [empRows] = await pool.query(
      "SELECT nome_fantasia, razao_social, logo_url FROM empresas WHERE id = ?",
      [empresaId]
    );
    if (empRows[0]) {
      companyName = empRows[0].nome_fantasia || empRows[0].razao_social || companyName;
      logoUrl = empRows[0].logo_url || null;
    }
  }

  const logoAttachment = await loadLogo({ logoUrl });
  const companyHeaderHtml = buildCompanyHeaderHtml(companyName, !!logoAttachment);

  let jsonItens = pedido.json_itens;
  if (typeof jsonItens === "string") {
    try {
      jsonItens = JSON.parse(jsonItens);
    } catch {
      jsonItens = [];
    }
  }

  const tabelaItensHtml = buildTabelaItensHtml(jsonItens);
  const orderNumber = String(pedido.numero_sequencial);
  const orderDate = pedido.data
    ? (pedido.data instanceof Date ? pedido.data.toISOString().slice(0, 10) : String(pedido.data).slice(0, 10))
    : new Date().toISOString().slice(0, 10);
  const orderDateFormatted = orderDate.split("-").reverse().join("/");

  const template = await getTemplate(req.user?.userId, "SUPPLIER_ORDER");
  const templateSubject = template?.subject || template?.subject_html || "Pedido #{{order_number}} - {{company_name}}";
  const templateBody = template?.html_body || template?.html || "";

  for (const forn of fornecedoresRows) {
    const email = forn.email && String(forn.email).trim();
    if (!email) {
      erros.push({ fornecedor_id: forn.id, mensagem: "Fornecedor sem e-mail cadastrado" });
      continue;
    }

    const supplierName = forn.nome_fantasia || forn.razao_social || "Fornecedor";

    const obs = pedido.observacoes && String(pedido.observacoes).trim();
    const observacoesHtml = obs
      ? `<p style="margin:12px 0 0;color:#555;line-height:1.6"><strong>Observações:</strong> ${escapeHtml(obs)}</p>`
      : "";

    const context = {
      order_number: orderNumber,
      order_date: orderDateFormatted,
      supplier_name: supplierName,
      company_name: companyName,
      company_header_html: companyHeaderHtml,
      tabela_itens: tabelaItensHtml,
      observacoes: obs || "",
      observacoes_html: observacoesHtml,
    };

    const subject = renderTemplate(templateSubject, context);
    const html = renderTemplate(templateBody, context);

    const extraAttachments = pdfAttachment ? [pdfAttachment] : [];
    try {
      await sendEmailWithInlineLogo(email, subject, html, { logoAttachment, extraAttachments });
      await logSupplierOrderEmail({
        pedidoCompraId: id,
        fornecedorId: forn.id,
        to: email,
        subject,
        html,
        sentByUserId: req.user?.userId,
        status: "SUCCESS",
      });
      enviados.push(forn.id);
    } catch (err) {
      const msg = err?.message || String(err);
      console.error("[pedidosCompra] Erro ao enviar e-mail para", email, msg);
      await logSupplierOrderEmail({
        pedidoCompraId: id,
        fornecedorId: forn.id,
        to: email,
        subject: "",
        html: "",
        sentByUserId: req.user?.userId,
        status: "ERROR",
        errorMessage: msg,
      }).catch(() => {});
      erros.push({ fornecedor_id: forn.id, mensagem: msg });
    }
  }

  if (enviados.length > 0) {
    await pool.query(
      "UPDATE pedidos_compra SET status = 'Enviado', updated_at = NOW() WHERE id = ?",
      [id]
    );
  }

  res.json({ enviados: enviados.length, erros });
}

export { list, getById, create, update, updateStatus, remove, enviarFornecedores };
