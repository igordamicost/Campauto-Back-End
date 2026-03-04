/**
 * Fiscal - integração Focus NFe v2.
 * Emissão, consulta, cancelamento, NFe recebidas e entrada de estoque.
 */

import * as focusNfe from "../src/services/focusNfe.service.js";
import { FocusNfRepository } from "../src/repositories/focusNf.repository.js";
import { executarEntradaEstoque } from "../src/services/fiscalEntradaEstoque.service.js";
import { db } from "../src/config/database.js";

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- Configuração de empresa (legado - use /api/v1/configuracao-fiscal) ---
async function configurarEmpresa(req, res) {
  const { empresa_id, cnpj, certificado_digital, senha_certificado, habilitar_nfe, habilitar_nfse, token_focus, ambiente, webhook_secret, ...rest } = req.body;
  const token = token_focus || (empresa_id ? (await FocusNfRepository.getTokenEmpresa(empresa_id)) : null);
  if (!token) {
    return res.status(400).json({ message: "token_focus é obrigatório. Configure via Configuração Fiscal." });
  }
  if (!empresa_id || !cnpj) {
    return res.status(400).json({ message: "empresa_id e cnpj são obrigatórios" });
  }

  const payload = {
    ...rest,
    cnpj: String(cnpj).replace(/\D/g, ""),
    certificado_digital: certificado_digital || rest.arquivo_certificado_base64,
    senha_certificado: senha_certificado || rest.senha_certificado,
    habilitar_nfe: habilitar_nfe ?? rest.habilita_nfe ?? false,
    habilitar_nfse: habilitar_nfse ?? rest.habilita_nfse ?? false,
  };

  const amb = (ambiente || "homologacao").toString().toLowerCase();
  const { status, data } = await focusNfe.configurarEmpresa(payload, token, amb);
  if (status >= 400) {
    return res.status(status).json(data || { message: "Erro na API Focus" });
  }

  await db.query(
    `INSERT INTO empresas_focus_config (empresa_id, token_focus, ambiente, webhook_secret, certificado_base64, emite_nfe, emite_nfse, cnpj)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE token_focus = VALUES(token_focus), ambiente = VALUES(ambiente), webhook_secret = VALUES(webhook_secret),
       certificado_base64 = VALUES(certificado_base64), emite_nfe = VALUES(emite_nfe), emite_nfse = VALUES(emite_nfse), cnpj = VALUES(cnpj)`,
    [empresa_id, token, amb, webhook_secret || null, payload.certificado_digital || payload.arquivo_certificado_base64 || null, payload.habilitar_nfe ? 1 : 0, payload.habilitar_nfse ? 1 : 0, payload.cnpj]
  );

  res.json({ success: true, data });
}

// --- Emissão NFe (assíncrona) ---
async function emitirNFe(req, res) {
  const { empresa_id, referencia, payload } = req.body;
  const empresaId = empresa_id ?? req.user?.empresa_id ?? 1;
  const config = await FocusNfRepository.getConfigEmpresa(empresaId);
  if (!config?.token_focus) {
    return res.status(400).json({ message: "Configuração Focus não encontrada. Configure em Configuração Fiscal." });
  }
  const { token_focus: token, ambiente } = config;

  const ref = referencia || `nfe_${Date.now()}`;
  const body = { ...payload };

  if (body.uf_emitente && body.uf_destinatario && body.local_destino == null) {
    body.local_destino = focusNfe.calcularLocalDestino(body.uf_emitente, body.uf_destinatario);
  }

  const { status, data } = await focusNfe.emitirNFe(ref, body, token, ambiente);
  if (status >= 400) {
    return res.status(status).json(data || { message: "Erro na API Focus" });
  }

  const focusNfId = await FocusNfRepository.upsertNota({
    tipo: "NFe",
    referencia: ref,
    empresa_id: empresaId,
    status: data.status || "processando_autorizacao",
    json_dados: data,
  });

  res.status(201).json({
    referencia: ref,
    status: data.status,
    focus_nf_id: focusNfId,
    message: "NFe enviada para processamento. Use polling ou webhook para acompanhar o status.",
  });
}

// --- Consulta status NFe ---
async function consultarNFe(req, res) {
  const { referencia } = req.params;
  const empresaId = req.query.empresa_id || req.user?.empresa_id || 1;
  const config = await FocusNfRepository.getConfigEmpresa(empresaId);
  if (!config?.token_focus) {
    return res.status(400).json({ message: "Configuração Focus não encontrada. Configure em Configuração Fiscal." });
  }
  const { token_focus: token, ambiente } = config;

  const { status, data } = await focusNfe.consultarNFe(referencia, token, ambiente);
  if (status >= 400) {
    return res.status(status).json(data || { message: "Nota não encontrada" });
  }

  await FocusNfRepository.upsertNota({
    tipo: "NFe",
    chave_nfe: data.chave_nfe,
    referencia,
    empresa_id: empresaId,
    status: data.status,
    json_dados: data,
  });

  res.json(data);
}

// --- Cancelamento NFe ---
async function cancelarNFe(req, res) {
  const { referencia } = req.params;
  const { justificativa } = req.body;
  const empresaId = req.body.empresa_id || req.user?.empresa_id || 1;

  if (!justificativa || String(justificativa).trim().length < 15) {
    return res.status(400).json({ message: "Justificativa obrigatória (15 a 255 caracteres)" });
  }
  if (String(justificativa).length > 255) {
    return res.status(400).json({ message: "Justificativa deve ter no máximo 255 caracteres" });
  }

  const config = await FocusNfRepository.getConfigEmpresa(empresaId);
  if (!config?.token_focus) {
    return res.status(400).json({ message: "Configuração Focus não encontrada. Configure em Configuração Fiscal." });
  }
  const { token_focus: token, ambiente } = config;

  const { status, data } = await focusNfe.cancelarNFe(referencia, justificativa.trim(), token, ambiente);
  if (status >= 400) {
    return res.status(status).json(data || { message: "Erro ao cancelar" });
  }

  await FocusNfRepository.upsertNota({
    tipo: "NFe",
    referencia,
    empresa_id: empresaId,
    status: data.status || "cancelado",
    json_dados: data,
  });

  res.json(data);
}

// --- NFe recebidas (com cache por chave_nfe e versao) ---
async function listarNfesRecebidas(req, res) {
  const empresaId = Number(req.query.empresa_id) || req.user?.empresa_id || 1;
  const config = await FocusNfRepository.getConfigEmpresa(empresaId);
  if (!config?.token_focus) {
    return res.status(400).json({ message: "Configuração Focus não encontrada. Configure em Configuração Fiscal." });
  }
  const { token_focus: token, ambiente } = config;

  const cnpj = await FocusNfRepository.getCnpjEmpresa(empresaId);
  if (!cnpj) {
    return res.status(400).json({ message: "CNPJ da empresa não encontrado" });
  }

  const versao = await FocusNfRepository.getUltimaVersaoRecebidas(empresaId);
  const { status, data } = await focusNfe.listarNfesRecebidas(cnpj, token, versao, ambiente);

  if (status >= 400) {
    return res.status(status).json(data || { message: "Erro na API Focus" });
  }

  const notas = Array.isArray(data) ? data : (data.notas || []);
  const inseridas = [];

  for (const n of notas) {
    const chave = n.chave_nfe || n.chave;
    if (!chave) continue;

    const existe = await FocusNfRepository.existePorChave(chave);
    if (existe) continue;

    let itens = n.items || n.itens || [];
    let dadosCompletos = n;

    if (itens.length === 0) {
      const { status: st, data: det } = await focusNfe.consultarNfeRecebida(chave, token, true, ambiente);
      if (st === 200 && det) {
        dadosCompletos = det;
        const req = det.requisicao_nota_fiscal || det;
        itens = req?.det || req?.items || req?.itens || [];
        if (Array.isArray(itens) && itens[0]?.prod) {
          itens = itens.map((d) => d.prod || d);
        }
      }
    }

    const focusNfId = await FocusNfRepository.upsertNota({
      tipo: "NFe_Recebida",
      chave_nfe: chave,
      empresa_id: empresaId,
      status: n.situacao || n.status || "autorizado",
      versao: n.versao,
      cnpj_destinatario: cnpj,
      numero: n.numero,
      serie: n.serie,
      data_emissao: n.data_emissao,
      valor_total: n.valor_total,
      json_dados: dadosCompletos,
    });

    if (itens.length > 0) {
      await FocusNfRepository.inserirItens(focusNfId, itens);
    }

    inseridas.push({ chave_nfe: chave, focus_nf_id: focusNfId });
  }

  const maxV = notas.reduce((m, n) => (n.versao != null ? Math.max(m, n.versao) : m), versao || 0);
  if (maxV > 0) {
    await FocusNfRepository.setUltimaVersaoRecebidas(empresaId, maxV);
  }

  res.json({
    total_recebido: notas.length,
    novas_inseridas: inseridas.length,
    notas: inseridas,
  });
}

// --- Vincular NFe recebida a pedido e dar entrada de estoque ---
async function vincularNfeRecebidaPedido(req, res) {
  const { focus_nf_id, pedido_compra_id } = req.body;
  if (!focus_nf_id || !pedido_compra_id) {
    return res.status(400).json({ message: "focus_nf_id e pedido_compra_id são obrigatórios" });
  }

  const nota = await FocusNfRepository.findById(focus_nf_id);
  if (!nota) {
    return res.status(404).json({ message: "Nota não encontrada" });
  }
  if (nota.tipo !== "NFe_Recebida") {
    return res.status(400).json({ message: "Apenas NFe recebida pode ser vinculada" });
  }
  if (nota.pedido_compra_id) {
    return res.status(400).json({ message: "Nota já vinculada a outro pedido" });
  }

  const empresaId = nota.empresa_id || 1;
  await FocusNfRepository.vincularPedidoCompra(focus_nf_id, pedido_compra_id);

  const resultado = await executarEntradaEstoque(
    focus_nf_id,
    empresaId,
    req.user?.id
  );

  res.json({
    success: true,
    focus_nf_id,
    pedido_compra_id,
    entrada_estoque: resultado,
  });
}

// --- Listar notas do cache ---
async function listarNotasCache(req, res) {
  const { tipo, empresa_id, status, limit = 50, offset = 0 } = req.query;
  const where = [];
  const params = [];

  if (tipo) {
    where.push("tipo = ?");
    params.push(tipo);
  }
  if (empresa_id) {
    where.push("empresa_id = ?");
    params.push(empresa_id);
  }
  if (status) {
    where.push("status = ?");
    params.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await db.query(
    `SELECT id, tipo, chave_nfe, referencia, empresa_id, status, numero, serie, data_emissao, valor_total, pedido_compra_id, created_at
     FROM focus_nf ${whereSql}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit) || 50, Number(offset) || 0]
  );

  const [[count]] = await db.query(
    `SELECT COUNT(*) AS total FROM focus_nf ${whereSql}`,
    params
  );

  res.json({ data: rows, total: count?.total ?? 0 });
}

// --- Emissão NFSe ---
async function emitirNFSe(req, res) {
  const { empresa_id, referencia, payload } = req.body;
  const empresaId = empresa_id ?? req.user?.empresa_id ?? 1;
  const config = await FocusNfRepository.getConfigEmpresa(empresaId);
  if (!config?.token_focus) {
    return res.status(400).json({ message: "Configuração Focus não encontrada. Configure em Configuração Fiscal." });
  }
  const { token_focus: token, ambiente } = config;

  const ref = referencia || `nfse_${Date.now()}`;
  const { status, data } = await focusNfe.emitirNFSe(ref, payload || {}, token, ambiente);
  if (status >= 400) {
    return res.status(status).json(data || { message: "Erro na API Focus" });
  }

  const focusNfId = await FocusNfRepository.upsertNota({
    tipo: "NFSe",
    referencia: ref,
    empresa_id: empresaId,
    status: data.status || "processando_autorizacao",
    json_dados: data,
  });

  res.status(201).json({
    referencia: ref,
    status: data.status,
    focus_nf_id: focusNfId,
  });
}

// --- Consulta NFSe ---
async function consultarNFSe(req, res) {
  const { referencia } = req.params;
  const empresaId = req.query.empresa_id || req.user?.empresa_id || 1;
  const config = await FocusNfRepository.getConfigEmpresa(empresaId);
  if (!config?.token_focus) {
    return res.status(400).json({ message: "Configuração Focus não encontrada. Configure em Configuração Fiscal." });
  }
  const { token_focus: token, ambiente } = config;

  const { status, data } = await focusNfe.consultarNFSe(referencia, token, ambiente);
  if (status >= 400) {
    return res.status(status).json(data || { message: "Nota não encontrada" });
  }

  await FocusNfRepository.upsertNota({
    tipo: "NFSe",
    chave_nfe: data.codigo_nfse,
    referencia,
    empresa_id: empresaId,
    status: data.status,
    json_dados: data,
  });

  res.json(data);
}

// --- Exportações (legado) ---
async function listExportacoes(req, res) {
  res.json({
    data: [],
    page: 1,
    perPage: Number(req.query.limit || req.query.perPage || 20),
    total: 0,
    totalPages: 0,
  });
}

// --- Webhook Focus (POST da API Focus quando nota é autorizada/rejeitada) ---
async function webhookNfe(req, res) {
  const { ref, status, chave_nfe } = req.body || {};
  if (!ref && !chave_nfe) {
    return res.status(400).json({ message: "ref ou chave_nfe obrigatório" });
  }

  const nota = ref
    ? await FocusNfRepository.findByReferencia(ref)
    : await FocusNfRepository.findByChave(chave_nfe);

  if (nota?.empresa_id) {
    const config = await FocusNfRepository.getConfigEmpresa(nota.empresa_id);
    const secret = config?.webhook_secret;
    if (secret && req.headers.authorization !== secret && req.headers["x-focus-token"] !== secret) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  }

  if (nota) {
    await FocusNfRepository.upsertNota({
      tipo: nota.tipo,
      chave_nfe: chave_nfe || nota.chave_nfe,
      referencia: ref || nota.referencia,
      empresa_id: nota.empresa_id,
      status: status || req.body?.status,
      json_dados: req.body,
    });
  }

  res.status(200).json({ received: true });
}

// --- Polling: consulta status e atualiza cache ---
async function pollNfeStatus(req, res) {
  const { referencia } = req.params;
  const empresaId = req.query.empresa_id || req.user?.empresa_id || 1;
  const config = await FocusNfRepository.getConfigEmpresa(empresaId);
  if (!config?.token_focus) {
    return res.status(400).json({ message: "Configuração Focus não encontrada. Configure em Configuração Fiscal." });
  }
  const { token_focus: token, ambiente } = config;

  const { status, data } = await focusNfe.consultarNFe(referencia, token, ambiente);
  if (status >= 400) {
    return res.status(status).json(data || { message: "Nota não encontrada" });
  }

  await FocusNfRepository.upsertNota({
    tipo: "NFe",
    chave_nfe: data.chave_nfe,
    referencia,
    empresa_id: empresaId,
    status: data.status,
    json_dados: data,
  });

  res.json(data);
}

export {
  configurarEmpresa,
  emitirNFe,
  consultarNFe,
  cancelarNFe,
  listarNfesRecebidas,
  vincularNfeRecebidaPedido,
  listarNotasCache,
  emitirNFSe,
  consultarNFSe,
  listExportacoes,
  webhookNfe,
  pollNfeStatus,
  asyncHandler,
};
