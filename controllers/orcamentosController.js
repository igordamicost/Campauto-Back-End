import * as baseService from "../services/baseService.js";
import { getPool } from "../db.js";
import { sendEmail as mailServiceSend } from "../src/services/email.service.js";
import { renderTemplate } from "../src/services/templateRenderService.js";

const TABLE = "orcamentos";
// Novo histórico por SERVIÇO; tabela antiga servico_item_valor_historico permanece apenas para legado
const TABLE_HISTORICO = "servico_valor_historico";

function calcularTotais(jsonItens, jsonItensServico, desconto = 0) {
  const totalPecas = !jsonItens || !Array.isArray(jsonItens)
    ? 0
    : jsonItens.reduce((sum, item) => sum + (parseFloat(item?.total) || 0), 0);

  const totalServico = !jsonItensServico || !Array.isArray(jsonItensServico)
    ? 0
    : jsonItensServico.reduce((sum, item) => sum + (parseFloat(item?.valor_unitario) || 0), 0);

  const subtotal = totalPecas + totalServico;
  const descontoValue = parseFloat(desconto) || 0;
  const total = subtotal - descontoValue;

  return {
    total_pecas: parseFloat(totalPecas.toFixed(2)),
    total_servico: parseFloat(totalServico.toFixed(2)),
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
  "Oficina",
  "Faturado",
  "Finalizado",
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

function validateJsonItensServicoArray(arr) {
  for (const item of arr) {
    if (!item) continue;
    const hasNested = Object.prototype.hasOwnProperty.call(item, "itens");
    if (hasNested) {
      // Novo formato: uma linha por serviço, itens como tags
      if (item.servico_id === undefined || item.servico_nome === undefined || item.valor_unitario === undefined) {
        return { parsed: null, error: "Cada serviço deve ter servico_id, servico_nome e valor_unitario" };
      }
      if (item.itens !== undefined && !Array.isArray(item.itens)) {
        return { parsed: null, error: "itens em json_itens_servico deve ser array" };
      }
    } else {
      // Formato antigo \"flat\": linha por subitem com valor_unitario próprio
      if (item.servico_id === undefined || item.valor_unitario === undefined) {
        return { parsed: null, error: "Cada item de serviço deve ter servico_id e valor_unitario" };
      }
    }
  }
  return { parsed: arr, error: null };
}

function normalizeJsonItensServico(jsonItensServico) {
  if (jsonItensServico === undefined || jsonItensServico === null || jsonItensServico === "") {
    return { parsed: [], error: null };
  }

  if (Array.isArray(jsonItensServico)) {
    return validateJsonItensServicoArray(jsonItensServico);
  }

  if (typeof jsonItensServico === "string") {
    try {
      const parsed = JSON.parse(jsonItensServico);
      if (!Array.isArray(parsed)) {
        return { parsed: null, error: "json_itens_servico deve ser array" };
      }
      return validateJsonItensServicoArray(parsed);
    } catch (error) {
      return { parsed: null, error: "json_itens_servico inválido" };
    }
  }

  return { parsed: null, error: "json_itens_servico deve ser array" };
}

async function gravarHistoricoValorServico(pool, orcamentoId, jsonItensServico, dataOrcamento) {
  if (!jsonItensServico || !Array.isArray(jsonItensServico) || jsonItensServico.length === 0) return;

  const dataStr = dataOrcamento
    ? String(dataOrcamento).slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Agregar por servico_id (tanto para formato novo quanto flat)
  const map = new Map(); // servico_id -> valor_total

  for (const item of jsonItensServico) {
    if (!item) continue;
    const servicoId = item.servico_id != null ? Number(item.servico_id) : null;
    const valor = item.valor_unitario != null ? Number(item.valor_unitario) : null;
    if (servicoId == null || Number.isNaN(servicoId) || valor == null || Number.isNaN(valor)) continue;
    map.set(servicoId, (map.get(servicoId) || 0) + valor);
  }

  for (const [servicoId, valorTotal] of map.entries()) {
    await pool.query(
      `INSERT INTO ${TABLE_HISTORICO} (servico_id, orcamento_id, valor, data) VALUES (?, ?, ?, ?)`,
      [servicoId, orcamentoId, valorTotal, dataStr]
    );
  }
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

async function veiculoExists(veiculoId) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT id FROM veiculos WHERE id = ? LIMIT 1",
    [Number(veiculoId)]
  );
  return rows.length > 0;
}

async function empresaExists(empresaId) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT id FROM empresas WHERE id = ? LIMIT 1",
    [Number(empresaId)]
  );
  return rows.length > 0;
}

async function list(req, res) {
  const role = String(req.user?.role || "").toUpperCase();
  const roleId = req.user?.roleId;
  const isMaster = role === "MASTER" || roleId === 1;
  const query = { ...req.query };
  if (!isMaster && req.user?.userId) {
    query.usuario_id__eq = req.user.userId;
  }

  const limit = Number(query.limit || query.perPage || 10);
  const page = Math.max(1, Number(query.page || 1));

  const { data, total } = await baseService.listWithFilters(TABLE, query);

  const include = query.include ? String(query.include).split(",").map((s) => s.trim()) : [];
  const includeClientes = include.includes("clientes");
  const includeEmpresas = include.includes("empresas");
  const includeVeiculos = include.includes("veiculos");
  const includeUsuario = include.includes("usuario") || include.includes("usuarios");

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
    const map = new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          name: row.name,
          nome: row.name,
          email: row.email,
          role: row.role
        }
      ])
    );
    data.forEach((row) => {
      const user = map.get(row.usuario_id) || null;
      row.responsavel = user;
      if (includeUsuario) {
        row.usuario = user;
      }
    });
  } else {
    data.forEach((row) => {
      row.responsavel = null;
      if (includeUsuario) row.usuario = null;
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
  const roleId = req.user?.roleId;
  const isMaster = role === "MASTER" || roleId === 1;
  if (!isMaster && req.user?.userId && item.usuario_id !== req.user.userId) {
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

  const hasHistorico = await tableExists(TABLE_HISTORICO);
  let jsonItensServico = item.json_itens_servico;

  if (jsonItensServico !== undefined && jsonItensServico !== null) {
    if (typeof jsonItensServico === "string") {
      try {
        jsonItensServico = JSON.parse(jsonItensServico);
      } catch {
        jsonItensServico = [];
      }
    }
  } else {
    jsonItensServico = [];
  }

  // Compatibilidade: se o formato for \"flat\" (sem itens[]), agrupar por serviço
  let jsonServicos = [];
  if (Array.isArray(jsonItensServico) && jsonItensServico.length > 0) {
    const isNovoFormato = jsonItensServico.some((s) => Array.isArray(s?.itens));
    if (isNovoFormato) {
      jsonServicos = jsonItensServico.map((s) => ({
        servico_id: s.servico_id,
        servico_nome: s.servico_nome,
        valor_unitario: Number(s.valor_unitario || 0),
        itens: Array.isArray(s.itens)
          ? s.itens.map((it) => ({
            item_id: it.item_id,
            descricao: it.descricao,
            concluido: !!it.concluido,
          }))
          : [],
      }));
    } else {
      // Formato antigo: uma linha por subitem com valor_unitario
      const mapServicos = new Map();
      for (const it of jsonItensServico) {
        if (!it) continue;
        const servicoId = it.servico_id != null ? Number(it.servico_id) : null;
        if (servicoId == null || Number.isNaN(servicoId)) continue;
        const key = servicoId;
        const atual = mapServicos.get(key) || {
          servico_id: servicoId,
          servico_nome: it.servico_nome,
          valor_unitario: 0,
          itens: [],
        };
        const valor = it.valor_unitario != null ? Number(it.valor_unitario) : 0;
        atual.valor_unitario += valor;
        if (it.item_id != null || it.descricao != null) {
          atual.itens.push({
            item_id: it.item_id,
            descricao: it.descricao,
            concluido: !!it.concluido,
          });
        }
        mapServicos.set(key, atual);
      }
      jsonServicos = Array.from(mapServicos.values());
    }
  }

  if (hasHistorico && jsonServicos.length > 0) {
    const servicoIds = [...new Set(jsonServicos.map((s) => s.servico_id).filter((id) => id != null && !Number.isNaN(Number(id))))];
    if (servicoIds.length > 0) {
      const placeholders = servicoIds.map(() => "?").join(",");
      const [histRows] = await pool.query(
        `SELECT servico_id, valor, data FROM ${TABLE_HISTORICO}
         WHERE servico_id IN (${placeholders})
         ORDER BY data DESC, id DESC`,
        servicoIds
      );
      const historicoByServico = new Map();
      for (const row of histRows) {
        const sid = row.servico_id;
        if (!historicoByServico.has(sid)) {
          historicoByServico.set(sid, []);
        }
        historicoByServico.get(sid).push({
          valor: Number(row.valor),
          data: row.data
            ? (row.data instanceof Date
              ? row.data.toISOString().slice(0, 10)
              : String(row.data).slice(0, 10))
            : null,
        });
      }
      jsonServicos = jsonServicos.map((s) => ({
        ...s,
        historico_valor: historicoByServico.get(Number(s.servico_id)) || [],
      }));
    }
  }

  item.json_itens_servico = jsonServicos;

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

  if (req.body.veiculo_id != null && req.body.veiculo_id !== "") {
    const veiculoOk = await veiculoExists(req.body.veiculo_id);
    if (!veiculoOk) {
      return res.status(400).json({ message: "veiculo_id inválido" });
    }
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

  const { parsed: jsonItensServicoParsed, error: jsonItensServicoError } = normalizeJsonItensServico(
    req.body.json_itens_servico
  );
  if (jsonItensServicoError) {
    return res.status(400).json({ message: jsonItensServicoError });
  }

  const numeroSequencial = await getProximoNumeroSequencial();

  const { total_pecas, total_servico, subtotal, desconto, total } = calcularTotais(
    jsonItensParsed,
    jsonItensServicoParsed,
    req.body.desconto || 0
  );

  const userId = req.user?.userId || null;
  if (req.body.usuario_id != null && Number(req.body.usuario_id) !== Number(userId)) {
    return res.status(400).json({
      message: "Não é permitido associar o orçamento a outro usuário. Use o usuário autenticado.",
    });
  }

  // Definir empresa emissora de acordo com a role e vínculo do usuário
  const role = String(req.user?.role || "").toUpperCase();
  const roleId = req.user?.roleId;
  const isMaster = role === "MASTER" || roleId === 1;

  let empresaId = null;

  if (isMaster) {
    if (req.body.empresa_id != null && req.body.empresa_id !== "") {
      const empOk = await empresaExists(req.body.empresa_id);
      if (!empOk) {
        return res.status(400).json({ message: "empresa_id inválido" });
      }
      empresaId = Number(req.body.empresa_id);
    } else {
      empresaId = null; // master pode criar orçamento sem empresa vinculada, se necessário
    }
  } else {
    const userEmpresaId = req.user?.empresaId ?? null;
    if (!userEmpresaId) {
      return res.status(400).json({
        message: "Usuário precisa estar vinculado a uma empresa para criar orçamento",
      });
    }
    const empOk = await empresaExists(userEmpresaId);
    if (!empOk) {
      return res.status(400).json({ message: "empresa do usuário inválida" });
    }
    empresaId = Number(userEmpresaId);
  }

  const dados = {
    ...req.body,
    empresa_id: empresaId,
    json_itens: jsonItensParsed ? JSON.stringify(jsonItensParsed) : null,
    json_itens_servico: jsonItensServicoParsed?.length
      ? JSON.stringify(jsonItensServicoParsed)
      : (Array.isArray(jsonItensServicoParsed) ? "[]" : null),
    numero_sequencial: numeroSequencial,
    usuario_id: userId,
    subtotal,
    desconto,
    total,
    total_pecas,
    total_servico,
  };

  const id = await baseService.create(TABLE, dados);
  if (!id) return res.status(409).json({ message: "Duplicate or invalid" });

  const pool = getPool();
  await gravarHistoricoValorServico(pool, id, jsonItensServicoParsed, req.body.data);

  res.status(201).json({ id, numero_sequencial: numeroSequencial });
}

async function update(req, res) {
  const dados = { ...req.body };

  const role = String(req.user?.role || "").toUpperCase();
  const roleId = req.user?.roleId;
  const isMaster = role === "MASTER" || roleId === 1;
  if (!isMaster) {
    delete dados.usuario_id;
  }

  if (dados.veiculo_id !== undefined && dados.veiculo_id !== null && dados.veiculo_id !== "") {
    const veiculoOk = await veiculoExists(dados.veiculo_id);
    if (!veiculoOk) {
      return res.status(400).json({ message: "veiculo_id inválido" });
    }
  }

  const { parsed: jsonItensParsed, error: jsonItensError } = normalizeJsonItens(
    dados.json_itens
  );
  if (jsonItensError) {
    return res.status(400).json({ message: jsonItensError });
  }

  const { parsed: jsonItensServicoParsed, error: jsonItensServicoError } = normalizeJsonItensServico(
    dados.json_itens_servico
  );
  if (jsonItensServicoError) {
    return res.status(400).json({ message: jsonItensServicoError });
  }

  const { total_pecas, total_servico, subtotal, desconto, total } = calcularTotais(
    jsonItensParsed,
    jsonItensServicoParsed,
    dados.desconto ?? 0
  );

  if (jsonItensParsed) {
    dados.json_itens = JSON.stringify(jsonItensParsed);
  } else if (dados.json_itens !== undefined) {
    dados.json_itens = null;
  }
  dados.json_itens_servico = jsonItensServicoParsed && jsonItensServicoParsed.length > 0
    ? JSON.stringify(jsonItensServicoParsed)
    : (jsonItensServicoParsed && Array.isArray(jsonItensServicoParsed) ? "[]" : null);
  dados.subtotal = subtotal;
  dados.desconto = desconto;
  dados.total = total;
  dados.total_pecas = total_pecas;
  dados.total_servico = total_servico;

  const ok = await baseService.update(TABLE, req.params.id, dados);
  if (!ok) return res.status(404).json({ message: "Not found or empty body" });

  const pool = getPool();
  const orcamentoId = Number(req.params.id);
  const dataOrcamento = dados.data || null;
  await gravarHistoricoValorServico(pool, orcamentoId, jsonItensServicoParsed, dataOrcamento);

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

  // Regra: não permitir Faturar se houver checklist de serviços incompleto
  if (status === "Faturado") {
    const pool = getPool();
    const orcamentoId = Number(req.params.id);
    const [rows] = await pool.query(
      "SELECT json_itens_servico FROM orcamentos WHERE id = ?",
      [orcamentoId]
    );
    if (rows.length > 0) {
      let servicos = rows[0].json_itens_servico;
      if (typeof servicos === "string") {
        try {
          servicos = JSON.parse(servicos);
        } catch {
          servicos = [];
        }
      }
      if (Array.isArray(servicos) && servicos.length > 0) {
        let incompleto = false;
        for (const s of servicos) {
          if (Array.isArray(s?.itens) && s.itens.length > 0) {
            if (s.itens.some((it) => !it.concluido)) {
              incompleto = true;
              break;
            }
          } else if (s.concluido === false) {
            incompleto = true;
            break;
          }
        }
        if (incompleto) {
          return res.status(409).json({
            message: "Checklist incompleto. Todos os itens de serviço devem estar concluídos antes de faturar.",
          });
        }
      }
    }
  }

  const ok = await baseService.update(TABLE, req.params.id, { status });
  if (!ok) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Status updated" });
}

async function remove(req, res) {
  const pool = getPool();
  const orcamentoId = Number(req.params.id);

  // Buscar orçamento para verificar status
  const [orcamentoRows] = await pool.query(
    "SELECT id, status FROM orcamentos WHERE id = ?",
    [orcamentoId]
  );

  if (orcamentoRows.length === 0) {
    return res.status(404).json({ message: "Orçamento não encontrado" });
  }

  const status = orcamentoRows[0].status;

  // Permitir delete apenas se status for 'Cotação' ou 'Cancelado'
  if (status !== 'Cotação' && status !== 'Cancelado') {
    return res.status(409).json({
      message: `Orçamento não pode ser excluído. Apenas orçamentos com status 'Cotação' ou 'Cancelado' podem ser excluídos. Status atual: ${status}`,
      status_atual: status,
    });
  }

  const ok = await baseService.remove(TABLE, req.params.id);
  if (!ok) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted" });
}

async function sendEmail(req, res) {
  const pool = getPool();
  const orcamentoId = Number(req.params.id);
  const userEmail = req.body?.email; // Optional override

  console.log("[sendEmail] Iniciando rota enviar-email para orçamento ID:", orcamentoId);
  console.log("[sendEmail] req.headers['content-type']:", req.headers['content-type']);
  console.log("[sendEmail] req.body:", req.body);
  console.log("[sendEmail] req.file:", req.file ? {
    fieldname: req.file.fieldname,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    hasBuffer: !!req.file.buffer
  } : "NENHUM ARQUIVO (undefined)");

  if (!req.file || !req.file.buffer) {
    console.warn("[sendEmail] Operação abortada: O arquivo PDF (file) não foi enviado na requisição.");
    return res.status(400).json({ message: "O arquivo PDF (file) não foi enviado." });
  }

  // 1. Fetch quote details (simulating getById internal logic but simplified)
  const [rows] = await pool.query("SELECT * FROM orcamentos WHERE id = ?", [orcamentoId]);
  const quote = rows[0];

  if (!quote) {
    return res.status(404).json({ message: "Orçamento não encontrado" });
  }

  // 2. Access control (MASTER or owner)
  const role = String(req.user?.role || "").toUpperCase();
  const roleId = req.user?.roleId;
  const isMaster = role === "MASTER" || roleId === 1;
  if (!isMaster && req.user?.userId && quote.usuario_id !== req.user.userId) {
    return res.status(403).json({ message: "Acesso negado" });
  }

  // Fetch relations for the templating
  if (quote.cliente_id) {
    const [clientes] = await pool.query("SELECT fantasia, razao_social, email, cpf_cnpj FROM clientes WHERE id = ?", [quote.cliente_id]);
    quote.clientes = clientes[0] ? { nome: clientes[0].fantasia || clientes[0].razao_social, cpf_cnpj: clientes[0].cpf_cnpj, email: clientes[0].email } : null;
  }

  if (quote.empresa_id) {
    const [empresas] = await pool.query("SELECT * FROM empresas WHERE id = ?", [quote.empresa_id]);
    quote.empresas = empresas[0] || null;
  }

  // 3. Determine recipient email
  const recipientEmail = userEmail || quote.clientes?.email;
  if (!recipientEmail || typeof recipientEmail !== 'string') {
    return res.status(400).json({ message: "O cliente não possui um e-mail cadastrado e nenhum e-mail foi fornecido na requisição." });
  }

  try {
    // 4. Extract PDF from Multer request
    const pdfBuffer = req.file.buffer;
    const fallbackFilename = `Orcamento_${quote.numero_sequencial || quote.id}.pdf`;
    const filename = req.file.originalname || fallbackFilename;

    // 5. Fetch email template
    const [tplRows] = await pool.query(
      "SELECT subject, html_body, is_active FROM email_templates WHERE template_key = ?",
      ["CLIENT_QUOTE"]
    );
    let tpl = tplRows[0];

    // Fallback se template estiver no DB inativo/ausente
    if (!tpl || !tpl.is_active) {
      if (!tpl && tplRows.length === 0) {
        // If totally absent, mock default dynamically using DEFAULTS from defaultEmailTemplates
        const { DEFAULT_CLIENT_QUOTE } = await import("../src/constants/defaultEmailTemplates.js");
        tpl = DEFAULT_CLIENT_QUOTE;
      } else {
        return res.status(400).json({ message: "O template de e-mail de orçamentos (CLIENT_QUOTE) está inativo no sistema." });
      }
    }

    // Prepare template data
    const templateData = {
      company_name: quote.empresas?.nome_fantasia || quote.empresas?.razao_social || process.env.COMPANY_NAME || "Campauto",
      company_logo: quote.empresas?.logo_url || "",
      client_name: quote.clientes?.nome || "Cliente",
      quote_number: quote.numero_sequencial || quote.id,
      quote_valid_until: quote.data ? new Date(new Date(quote.data).getTime() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR') : "15 dias", // Assume 15 days validity or whatever domain logic indicates
      quote_total: `R$ ${Number(quote.total || 0).toFixed(2).replace('.', ',')}`
    };

    const renderedSubject = renderTemplate(tpl.subject, templateData);
    const renderedBody = renderTemplate(tpl.html_body, templateData);

    // 6. Send Email with Attachment
    const attachments = [
      {
        filename: filename,
        content: pdfBuffer,
        contentType: req.file.mimetype || 'application/pdf'
      }
    ];

    await mailServiceSend(recipientEmail, renderedSubject, renderedBody, attachments);

    return res.status(200).json({ message: "E-mail enviado com sucesso" });
  } catch (error) {
    console.error("[sendEmail Quote] Falha:", error);
    return res.status(500).json({ message: "Falha ao processar o arquivo ou enviar o e-mail.", error: error.message });
  }
}

export { list, getById, create, update, updateStatus, remove, sendEmail };
