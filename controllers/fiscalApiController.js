/**
 * API v1 Fiscal - Contratos padronizados Front → Back.
 * Mapeia os payloads do front para a integração Focus NFe.
 */

import * as focusNfe from "../src/services/focusNfe.service.js";
import { FocusNfRepository } from "../src/repositories/focusNf.repository.js";
import { executarEntradaEstoque } from "../src/services/fiscalEntradaEstoque.service.js";
import { db } from "../src/config/database.js";

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- 1. Configuração Fiscal (cadastro na Focus + certificado A1) ---
async function configuracaoFiscal(req, res) {
  const {
    cnpj,
    razao_social,
    nome_fantasia,
    inscricao_estadual,
    inscricao_municipal,
    regime_tributario,
    logradouro,
    numero,
    bairro,
    cep,
    municipio,
    uf,
    email,
    telefone,
    arquivo_certificado_base64,
    senha_certificado,
    habilita_nfe,
    habilita_nfse,
    empresa_id,
    token_focus,
    ambiente,
    webhook_secret,
  } = req.body;

  const empId = empresa_id ? Number(empresa_id) : null;
  if (!empId) {
    return res.status(400).json({ message: "empresa_id é obrigatório" });
  }

  if (!cnpj || !razao_social) {
    return res.status(400).json({ message: "cnpj e razao_social são obrigatórios" });
  }

  const token = token_focus || (await FocusNfRepository.getTokenEmpresa(empId));
  if (!token) {
    return res.status(400).json({ message: "token_focus é obrigatório. Configure via tela de Configuração Fiscal." });
  }

  const cnpjLimpo = String(cnpj).replace(/\D/g, "");
  const [empRows] = await db.query(
    "SELECT id, nome_fantasia, razao_social, cnpj, endereco, cep, email, cidade, telefone, estado FROM empresas WHERE id = ?",
    [empId]
  );
  const empresa = empRows[0];
  if (!empresa) {
    return res.status(404).json({ message: "Empresa não encontrada" });
  }

  const enderecoAtual = empresa.endereco || "";
  const [logradouroAtual, numeroAtual] = enderecoAtual.split(",").map((s) => s.trim());
  const logr = (logradouro || logradouroAtual || "").trim() || "Endereço";
  const num = (numero || numeroAtual || "S/N").toString().replace(/\D/g, "") || "0";
  const enderecoMontado = `${logr}, ${num}`;

  const payload = {
    cnpj: cnpjLimpo,
    nome: razao_social,
    nome_fantasia: nome_fantasia || empresa.nome_fantasia || razao_social,
    inscricao_estadual: String(inscricao_estadual || "").trim() || "0",
    inscricao_municipal: String(inscricao_municipal || "").trim() || "0",
    regime_tributario: Number(regime_tributario) || 1,
    email: (email || empresa.email || "").trim() || "contato@empresa.com.br",
    telefone: (telefone || empresa.telefone || "").replace(/\D/g, "").slice(0, 11) || "11999999999",
    logradouro: logr,
    numero: num,
    bairro: (bairro || "").trim() || "Centro",
    cep: (cep || empresa.cep || "").replace(/\D/g, "").slice(0, 8) || "79000000",
    municipio: (municipio || empresa.cidade || "").trim() || "Campo Grande",
    uf: (uf || empresa.estado || "").trim().slice(0, 2) || "MS",
    arquivo_certificado_base64: arquivo_certificado_base64 || undefined,
    senha_certificado: senha_certificado || undefined,
    habilita_nfe: Boolean(habilita_nfe),
    habilita_nfse: Boolean(habilita_nfse),
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
       certificado_base64 = COALESCE(VALUES(certificado_base64), certificado_base64), emite_nfe = VALUES(emite_nfe), emite_nfse = VALUES(emite_nfse), cnpj = VALUES(cnpj)`,
    [empId, token, amb, webhook_secret || null, arquivo_certificado_base64 || null, payload.habilita_nfe ? 1 : 0, payload.habilita_nfse ? 1 : 0, cnpjLimpo]
  );

  const updatesEmpresa = {};
  if (nome_fantasia !== undefined) updatesEmpresa.nome_fantasia = nome_fantasia;
  if (razao_social !== undefined) updatesEmpresa.razao_social = razao_social;
  if (cnpj !== undefined) updatesEmpresa.cnpj = cnpj;
  if (logradouro !== undefined || numero !== undefined) updatesEmpresa.endereco = enderecoMontado;
  if (cep !== undefined) updatesEmpresa.cep = cep;
  if (municipio !== undefined) updatesEmpresa.cidade = municipio;
  if (uf !== undefined) updatesEmpresa.estado = uf;
  if (email !== undefined) updatesEmpresa.email = email;
  if (telefone !== undefined) updatesEmpresa.telefone = telefone;

  if (Object.keys(updatesEmpresa).length > 0) {
    const setSql = Object.keys(updatesEmpresa).map((c) => `\`${c}\` = ?`).join(", ");
    await db.query(`UPDATE empresas SET ${setSql} WHERE id = ?`, [...Object.values(updatesEmpresa), empId]);
  }

  res.json({ success: true, data });
}

// --- 2. Emissão NFe (venda, garantia, devolução) ---
function mapTipoOperacaoParaFinalidade(tipo) {
  const t = String(tipo || "").toLowerCase();
  if (t === "devolucao") return 4;
  if (t === "garantia") return 1;
  return 1; // venda = normal
}

function mapTipoOperacaoParaNatureza(tipo) {
  const t = String(tipo || "").toLowerCase();
  if (t === "devolucao") return "Devolução de mercadoria";
  if (t === "garantia") return "Remessa para garantia";
  return "Venda de mercadoria";
}

async function emitirNFeV1(req, res) {
  const { tipo_operacao, natureza_operacao, cliente, itens, venda_id, empresa_id, orcamento_id, observacoes_nf } = req.body;
  const empresaId = empresa_id ?? req.user?.empresa_id ?? 1;

  const config = await FocusNfRepository.getConfigEmpresa(empresaId);
  if (!config?.token_focus) {
    return res.status(400).json({ message: "Configuração Focus não encontrada. Configure token e certificado em Configuração Fiscal." });
  }
  const { token_focus: token, ambiente } = config;

  if (!cliente || !itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ message: "cliente e itens (array) são obrigatórios" });
  }

  // Observações NF: prioridade body > orçamento
  let observacoesNf = String(observacoes_nf || "").trim();
  if (!observacoesNf && orcamento_id) {
    const [orcRows] = await db.query("SELECT observacoes_nf FROM orcamentos WHERE id = ?", [Number(orcamento_id)]);
    observacoesNf = String(orcRows[0]?.observacoes_nf || "").trim();
  }

  const [empresaRow] = await db.query(
    "SELECT e.*, efc.cnpj AS cnpj_focus FROM empresas e LEFT JOIN empresas_focus_config efc ON e.id = efc.empresa_id WHERE e.id = ?",
    [empresaId]
  );
  const emp = empresaRow[0];
  if (!emp) {
    return res.status(400).json({ message: "Empresa não encontrada" });
  }

  const ref = venda_id ? `venda_${venda_id}` : `nfe_${Date.now()}`;
  const doc = String(cliente.cpf_cnpj || "").replace(/\D/g, "");
  const isCpf = doc.length <= 11;

  const ufEmitente = (emp.estado || emp.uf || "MS").toString().trim().toUpperCase();
  const ufDestinatario = (cliente.uf || "MS").toString().trim().toUpperCase();
  const localDestino = focusNfe.calcularLocalDestino(ufEmitente, ufDestinatario);

  const focusItems = itens.map((it, i) => ({
    numero_item: i + 1,
    codigo_produto: it.codigo_produto || it.codigo || String(i + 1),
    descricao: it.descricao || "Produto",
    codigo_ncm: String(it.ncm || "00000000").replace(/\D/g, "").slice(0, 8) || "00000000",
    cfop: Number(it.cfop) || (localDestino === 1 ? 5102 : 6102),
    unidade_comercial: it.unidade || "UN",
    quantidade_comercial: Number(it.quantidade) || 1,
    valor_unitario_comercial: Number(it.valor_unitario) || 0,
    valor_unitario_tributavel: Number(it.valor_unitario) || 0,
    quantidade_tributavel: Number(it.quantidade) || 1,
    unidade_tributavel: it.unidade || "UN",
    valor_bruto: (Number(it.quantidade) || 1) * (Number(it.valor_unitario) || 0),
    icms_situacao_tributaria: it.icms_cst ?? 41,
    icms_origem: it.icms_origem ?? 0,
    pis_situacao_tributaria: it.pis_cst ?? "07",
    cofins_situacao_tributaria: it.cofins_cst ?? "07",
  }));

  const valorProdutos = focusItems.reduce((s, it) => s + (it.valor_bruto || 0), 0);

  const payload = {
    natureza_operacao: natureza_operacao || mapTipoOperacaoParaNatureza(tipo_operacao),
    data_emissao: new Date().toISOString().slice(0, 19),
    data_entrada_saida: new Date().toISOString().slice(0, 19),
    tipo_documento: 1,
    finalidade_emissao: mapTipoOperacaoParaFinalidade(tipo_operacao),
    local_destino: localDestino,
    cnpj_emitente: isCpf ? undefined : (emp.cnpj_focus || emp.cnpj || "").replace(/\D/g, ""),
    cpf_emitente: isCpf ? undefined : undefined,
    nome_emitente: emp.razao_social || emp.nome_fantasia,
    nome_fantasia_emitente: emp.nome_fantasia || emp.razao_social,
    logradouro_emitente: emp.endereco || "Rua",
    numero_emitente: 1,
    bairro_emitente: "Centro",
    municipio_emitente: emp.cidade || "Campo Grande",
    uf_emitente: ufEmitente,
    cep_emitente: (emp.cep || "79000000").replace(/\D/g, ""),
    inscricao_estadual_emitente: emp.inscricao_estadual || "",
    nome_destinatario: cliente.nome,
    cpf_destinatario: isCpf ? doc : undefined,
    cnpj_destinatario: isCpf ? undefined : doc,
    logradouro_destinatario: cliente.endereco?.logradouro || "Endereço",
    numero_destinatario: cliente.endereco?.numero || "S/N",
    bairro_destinatario: cliente.endereco?.bairro || "Centro",
    municipio_destinatario: cliente.endereco?.municipio || "Campo Grande",
    uf_destinatario: ufDestinatario,
    cep_destinatario: (cliente.endereco?.cep || "").replace(/\D/g, ""),
    pais_destinatario: "Brasil",
    valor_frete: 0,
    valor_seguro: 0,
    valor_total: valorProdutos,
    valor_produtos: valorProdutos,
    modalidade_frete: 0,
    consumidor_final: 1,
    presenca_comprador: 1,
    indicador_inscricao_estadual_destinatario: 9,
    items: focusItems,
  };

  if (observacoesNf) {
    payload.informacoes_adicionais = observacoesNf;
  }

  const { status, data } = await focusNfe.emitirNFe(ref, payload, token, ambiente);
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

// --- 3. Emissão NFSe (Campo Grande) ---
async function emitirNFSeV1(req, res) {
  const { venda_id, servico, tomador, empresa_id } = req.body;
  const empresaId = empresa_id ?? req.user?.empresa_id ?? 1;

  const config = await FocusNfRepository.getConfigEmpresa(empresaId);
  if (!config?.token_focus) {
    return res.status(400).json({ message: "Configuração Focus não encontrada. Configure em Configuração Fiscal." });
  }
  const { token_focus: token, ambiente } = config;

  if (!servico || !tomador) {
    return res.status(400).json({ message: "servico e tomador são obrigatórios" });
  }

  const ref = venda_id ? `nfse_venda_${venda_id}` : `nfse_${Date.now()}`;

  const [empresaRow] = await db.query(
    "SELECT * FROM empresas WHERE id = ?",
    [empresaId]
  );
  const emp = empresaRow[0];
  if (!emp) {
    return res.status(400).json({ message: "Empresa não encontrada" });
  }

  const payload = {
    data_emissao: new Date().toISOString().slice(0, 19),
    prestador: {
      cnpj: (emp.cnpj || "").replace(/\D/g, ""),
      inscricao_municipal: emp.inscricao_municipal || "",
    },
    tomador: {
      cnpj: String(tomador.cnpj || "").replace(/\D/g, ""),
      razao_social: tomador.razao_social || tomador.nome,
    },
    servico: {
      item_lista_servico: servico.item_lista_servico || "0107",
      codigo_tributario_municipio: servico.codigo_tributario_municipio || "620910000",
      discriminacao: servico.discriminacao || "Prestação de serviço",
      valor_servicos: Number(servico.valor_servicos) || 0,
    },
  };

  const { status, data } = await focusNfe.emitirNFSe(ref, payload, token, ambiente);
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

// --- 4. Notas Recebidas (consolidado com no_estoque, pedido_vinculado) ---
async function notasRecebidas(req, res) {
  const cnpj = req.query.cnpj;
  const empresaId = Number(req.query.empresa_id) || req.user?.empresa_id || 1;

  const config = await FocusNfRepository.getConfigEmpresa(empresaId);
  if (!config?.token_focus) {
    return res.status(400).json({ message: "Configuração Focus não encontrada. Configure em Configuração Fiscal." });
  }
  const { token_focus: token, ambiente } = config;

  const cnpjBusca = cnpj ? String(cnpj).replace(/\D/g, "") : await FocusNfRepository.getCnpjEmpresa(empresaId);
  if (!cnpjBusca) {
    return res.status(400).json({ message: "CNPJ não informado e não encontrado para a empresa" });
  }

  const versao = await FocusNfRepository.getUltimaVersaoRecebidas(empresaId);
  const { status, data } = await focusNfe.listarNfesRecebidas(cnpjBusca, token, versao, ambiente);

  if (status >= 400) {
    return res.status(status).json(data || { message: "Erro na API Focus" });
  }

  const notasApi = Array.isArray(data) ? data : (data.notas || []);
  const inseridas = [];

  for (const n of notasApi) {
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
        const reqNf = det.requisicao_nota_fiscal || det;
        itens = reqNf?.det || reqNf?.items || reqNf?.itens || [];
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
      cnpj_destinatario: cnpjBusca,
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

  const maxV = notasApi.reduce((m, n) => (n.versao != null ? Math.max(m, n.versao) : m), versao || 0);
  if (maxV > 0) {
    await FocusNfRepository.setUltimaVersaoRecebidas(empresaId, maxV);
  }

  const [rows] = await db.query(
    `SELECT fn.id, fn.chave_nfe AS chave, fn.valor_total, fn.data_emissao, fn.pedido_compra_id AS pedido_vinculado,
            COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fn.json_dados, '$.nome_emitente')), '') AS nome_emitente,
            CASE WHEN fn.pedido_compra_id IS NOT NULL THEN 1 ELSE 0 END AS no_estoque
     FROM focus_nf fn
     WHERE fn.tipo = 'NFe_Recebida' AND fn.empresa_id = ?
     ORDER BY fn.data_emissao DESC
     LIMIT 200`,
    [empresaId]
  );

  const resultado = rows.map((r) => ({
    chave: r.chave,
    nome_emitente: r.nome_emitente,
    valor_total: String(r.valor_total || "0"),
    data_emissao: r.data_emissao,
    no_estoque: Boolean(r.no_estoque),
    pedido_vinculado: r.pedido_vinculado,
  }));

  res.json(resultado);
}

// --- 5. Cancelamento NFe ---
async function cancelarNFeV1(req, res) {
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

// --- 6. Consulta Status NFe (mapeado para interface) ---
const STATUS_MAP = {
  autorizado: "autorizado",
  processando_autorizacao: "processando",
  erro_autorizacao: "erro",
  cancelado: "cancelado",
  denegado: "denegado",
};

async function statusNFe(req, res) {
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

  const base = ambiente === "producao" ? "https://api.focusnfe.com.br" : "https://homologacao.focusnfe.com.br";
  const urlXml = data.caminho_xml_nota_fiscal ? `${base}${data.caminho_xml_nota_fiscal}` : null;

  await FocusNfRepository.upsertNota({
    tipo: "NFe",
    chave_nfe: data.chave_nfe,
    referencia,
    empresa_id: empresaId,
    status: data.status,
    json_dados: data,
    caminho_xml_nota_fiscal: urlXml,
  });

  const statusInterface = STATUS_MAP[data.status] || data.status;

  res.json({
    referencia,
    status: statusInterface,
    status_focus: data.status,
    chave_nfe: data.chave_nfe,
    caminho_xml_nota_fiscal: data.caminho_xml_nota_fiscal,
    mensagem_sefaz: data.mensagem_sefaz,
  });
}

// --- Importar nota por chave (bipar) e dar entrada no estoque ---
async function importarPorChave(req, res) {
  const { chave_nfe, empresa_id } = req.body;
  const empresaId = empresa_id ?? req.user?.empresa_id ?? 1;

  const chave = String(chave_nfe || "").replace(/\D/g, "");
  if (chave.length !== 44) {
    return res.status(400).json({ message: "Chave da NFe deve ter 44 dígitos" });
  }

  const config = await FocusNfRepository.getConfigEmpresa(empresaId);
  if (!config?.token_focus) {
    return res.status(400).json({ message: "Configuração Focus não encontrada. Configure em Configuração Fiscal." });
  }
  const { token_focus: token, ambiente } = config;

  const existe = await FocusNfRepository.existePorChave(chave);
  let focusNfId;

  if (existe) {
    const nota = await FocusNfRepository.findByChave(chave);
    focusNfId = nota.id;
    if (nota.pedido_compra_id) {
      return res.status(400).json({
        message: "Nota já vinculada a pedido e com entrada no estoque",
        focus_nf_id: focusNfId,
      });
    }
  } else {
    const { status: st, data: det } = await focusNfe.consultarNfeRecebida(chave, token, true, ambiente);
    if (st !== 200 || !det) {
      return res.status(st >= 400 ? st : 404).json(det || { message: "Nota não encontrada na Focus" });
    }

    const reqNf = det.requisicao_nota_fiscal || det;
    let itens = reqNf?.det || reqNf?.items || reqNf?.itens || [];
    if (Array.isArray(itens) && itens[0]?.prod) {
      itens = itens.map((d) => d.prod || d);
    }

    const cnpj = await FocusNfRepository.getCnpjEmpresa(empresaId);
    focusNfId = await FocusNfRepository.upsertNota({
      tipo: "NFe_Recebida",
      chave_nfe: chave,
      empresa_id: empresaId,
      status: det.situacao || det.status || "autorizado",
      cnpj_destinatario: cnpj,
      numero: det.numero,
      serie: det.serie,
      data_emissao: det.data_emissao,
      valor_total: det.valor_total,
      json_dados: det,
    });

    if (itens.length > 0) {
      await FocusNfRepository.inserirItens(focusNfId, itens);
    }
  }

  const resultado = await executarEntradaEstoque(focusNfId, empresaId, req.user?.id);

  res.json({
    success: true,
    focus_nf_id: focusNfId,
    chave_nfe: chave,
    entrada_estoque: resultado,
  });
}

// --- Vincular NFe recebida a pedido (dar entrada) ---
async function vincularPedido(req, res) {
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

  const resultado = await executarEntradaEstoque(focus_nf_id, empresaId, req.user?.id);

  res.json({
    success: true,
    focus_nf_id,
    pedido_compra_id,
    entrada_estoque: resultado,
  });
}

// --- Obter configuração Focus (para o front carregar o formulário) ---
async function obterConfiguracaoFiscal(req, res) {
  const empresaId = Number(req.query.empresa_id) || req.user?.empresa_id || 1;
  const row = await FocusNfRepository.getConfigEmpresaCompleta(empresaId);
  if (!row) {
    return res.status(404).json({ message: "Empresa não encontrada" });
  }
  const cnpjVal = row.cnpj_focus || row.cnpj;
  res.json({
    empresa_id: row.empresa_id,
    cnpj: cnpjVal ? String(cnpjVal).replace(/\D/g, "").padStart(14, "0") : null,
    razao_social: row.razao_social,
    nome_fantasia: row.nome_fantasia,
    token_focus: row.token_focus ? "***" : null,
    ambiente: row.ambiente || "homologacao",
    webhook_secret: row.webhook_secret ? "***" : null,
    configurado: !!(row.token_focus && String(row.token_focus).trim()),
    certificado_configurado: !!row.certificado_configurado,
    habilita_nfe: Boolean(row.emite_nfe),
    habilita_nfse: Boolean(row.emite_nfse),
    endereco: row.endereco,
    cep: row.cep,
    cidade: row.cidade,
    estado: row.estado,
    email: row.email,
    telefone: row.telefone,
  });
}

export {
  configuracaoFiscal,
  obterConfiguracaoFiscal,
  emitirNFeV1,
  emitirNFSeV1,
  notasRecebidas,
  importarPorChave,
  cancelarNFeV1,
  statusNFe,
  vincularPedido,
  asyncHandler,
};
