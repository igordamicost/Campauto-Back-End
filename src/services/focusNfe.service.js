/**
 * Serviço wrapper da API Focus NFe v2.
 * Basic Auth: token como usuário, senha vazia.
 * Ambientes: homologação e produção.
 */

import { db } from "../config/database.js";

const BASE_HOMOLOG = "https://homologacao.focusnfe.com.br";
const BASE_PROD = "https://api.focusnfe.com.br";

/**
 * Retorna base URL conforme ambiente.
 * ambiente vem do banco (empresas_focus_config), fallback para .env apenas em dev.
 */
function getBaseUrl(ambiente) {
  const amb = (ambiente || process.env.FOCUS_NFE_AMBIENTE || "homologacao").toString().toLowerCase();
  return amb === "producao" ? BASE_PROD : BASE_HOMOLOG;
}

/**
 * Faz requisição à API Focus com Basic Auth.
 * @param {Object} options
 * @param {string} options.method - GET, POST, DELETE
 * @param {string} options.path - Ex: /v2/nfe/REF123
 * @param {string} options.token - Token da API
 * @param {Object} [options.body] - Body JSON para POST
 * @param {string} [options.referencia] - Para log
 * @param {string} [options.chaveNfe] - Para log
 */
export async function focusRequest({ method, path, token, body, referencia, chaveNfe, ambiente }) {
  const base = getBaseUrl(ambiente);
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const auth = Buffer.from(`${token}:`).toString("base64");

  const opts = {
    method: method || "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  };
  if (body && ["POST", "PUT", "PATCH", "DELETE"].includes(opts.method)) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  const text = await res.text();
  let responseBody;
  try {
    responseBody = text ? JSON.parse(text) : null;
  } catch {
    responseBody = { raw: text };
  }

  // Log erros 4xx/5xx para auditoria
  if (res.status >= 400) {
    await logApiError({
      metodo: opts.method,
      url,
      status_http: res.status,
      request_body: body,
      response_body: responseBody,
      referencia,
      chave_nfe: chaveNfe,
    });
  }

  return { status: res.status, data: responseBody };
}

async function logApiError(payload) {
  try {
    await db.query(
      `INSERT INTO focus_api_log (metodo, url, status_http, request_body, response_body, referencia, chave_nfe)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.metodo,
        payload.url,
        payload.status_http,
        payload.request_body ? JSON.stringify(payload.request_body) : null,
        payload.response_body ? JSON.stringify(payload.response_body) : null,
        payload.referencia || null,
        payload.chave_nfe || null,
      ]
    );
  } catch (e) {
    console.error("[focusNfe] Erro ao salvar log:", e.message);
  }
}

/**
 * Envia NFe para emissão (POST).
 * @param {string} ref - Referência única
 * @param {Object} payload - Dados da NFe
 * @param {string} token
 * @param {string} [ambiente] - homologacao ou producao (do banco)
 */
export async function emitirNFe(ref, payload, token, ambiente) {
  return focusRequest({
    method: "POST",
    path: `/v2/nfe?ref=${encodeURIComponent(ref)}`,
    token,
    body: payload,
    referencia: ref,
    ambiente,
  });
}

/**
 * Consulta status da NFe (GET).
 */
export async function consultarNFe(ref, token, ambiente) {
  return focusRequest({
    method: "GET",
    path: `/v2/nfe/${encodeURIComponent(ref)}`,
    token,
    referencia: ref,
    ambiente,
  });
}

/**
 * Cancela NFe (DELETE).
 */
export async function cancelarNFe(ref, justificativa, token, ambiente) {
  return focusRequest({
    method: "DELETE",
    path: `/v2/nfe/${encodeURIComponent(ref)}`,
    token,
    body: { justificativa },
    referencia: ref,
    ambiente,
  });
}

/**
 * Busca NFe recebidas (GET /v2/nfes_recebidas).
 */
export async function listarNfesRecebidas(cnpj, token, versao = null, ambiente) {
  let path = `/v2/nfes_recebidas?cnpj=${encodeURIComponent(cnpj)}`;
  if (versao != null) path += `&versao=${versao}`;
  return focusRequest({ method: "GET", path, token, ambiente });
}

/**
 * Consulta detalhes de NFe recebida por chave.
 */
export async function consultarNfeRecebida(chave, token, completa = true, ambiente) {
  const path = `/v2/nfes_recebidas/${encodeURIComponent(chave)}.json${completa ? "?completa=1" : ""}`;
  return focusRequest({
    method: "GET",
    path,
    token,
    chaveNfe: chave,
    ambiente,
  });
}

/**
 * Configura empresa na Focus (POST /v2/empresas).
 */
export async function configurarEmpresa(payload, token, ambiente) {
  const body = { ...payload };
  if (body.certificado_digital != null) {
    body.arquivo_certificado_base64 = body.certificado_digital;
    delete body.certificado_digital;
  }
  if (body.habilitar_nfe != null) {
    body.habilita_nfe = Boolean(body.habilitar_nfe);
    delete body.habilitar_nfe;
  }
  if (body.habilitar_nfse != null) {
    body.habilita_nfse = Boolean(body.habilitar_nfse);
    delete body.habilitar_nfse;
  }
  return focusRequest({
    method: "POST",
    path: "/v2/empresas",
    token,
    body,
    ambiente,
  });
}

/**
 * Emite NFSe (POST).
 */
export async function emitirNFSe(ref, payload, token, ambiente) {
  return focusRequest({
    method: "POST",
    path: `/v2/nfse?ref=${encodeURIComponent(ref)}`,
    token,
    body: payload,
    referencia: ref,
    ambiente,
  });
}

/**
 * Consulta NFSe (GET).
 */
export async function consultarNFSe(ref, token, ambiente) {
  return focusRequest({
    method: "GET",
    path: `/v2/nfse/${encodeURIComponent(ref)}`,
    token,
    referencia: ref,
    ambiente,
  });
}

/**
 * Calcula local_destino (1-Interno, 2-Interestadual) comparando UFs.
 */
export function calcularLocalDestino(ufEmitente, ufDestinatario) {
  const ufE = String(ufEmitente || "").trim().toUpperCase();
  const ufD = String(ufDestinatario || "").trim().toUpperCase();
  if (!ufE || !ufD) return 1;
  return ufE === ufD ? 1 : 2;
}

export { getBaseUrl };
