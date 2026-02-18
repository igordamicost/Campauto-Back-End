import { getPool } from "../db.js";

/** Cache das colunas da tabela produtos (para suporte opcional a observacao_id) */
let produtosColumnsCache = null;

async function getProdutosColumns() {
  if (produtosColumnsCache) return produtosColumnsCache;
  const pool = getPool();
  const [rows] = await pool.query("SHOW COLUMNS FROM `produtos`");
  produtosColumnsCache = rows.map((r) => r.Field);
  return produtosColumnsCache;
}

/** Preposições a remover na normalização (como palavras inteiras) */
const PREPOSICOES = [
  " de ",
  " da ",
  " do ",
  " das ",
  " dos ",
  " e ",
  " em ",
  " no ",
  " na ",
  " nos ",
  " nas ",
  " ao ",
  " aos ",
  " a ",
  " o ",
  " a ",
  " um ",
  " uma ",
  " por ",
  " para ",
  " com ",
  " sem ",
];

/** Colunas de texto usadas na busca concatenada */
const SEARCH_COLUMNS = [
  "codigo_produto",
  "codigo_barra",
  "codigo_referencia",
  "codigo_original",
  "descricao",
  "observacao",
  "nome_secao",
  "nome_marca",
  "nome_linha",
  "nome_grupo",
  "nome_subgrupo",
];

/**
 * Normaliza texto para busca: lowercase, remove preposições, colapsa espaços.
 * @param {string} text
 * @returns {string}
 */
export function normalizeSearchText(text) {
  if (typeof text !== "string") return "";
  let t = text.trim().toLowerCase();
  for (const prep of PREPOSICOES) {
    t = t.split(prep).join(" ");
  }
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Extrai termos de busca a partir da string q (split por espaço, normaliza cada termo).
 * @param {string} q
 * @returns {string[]}
 */
export function getSearchTerms(q) {
  if (!q || typeof q !== "string") return [];
  return q
    .trim()
    .split(/\s+/)
    .map((t) => normalizeSearchText(t))
    .filter((t) => t.length > 0);
}

/**
 * Gera expressão SQL que normaliza um conjunto de colunas concatenadas
 * (LOWER + CONCAT_WS + REPLACE das preposições).
 * Usado para comparar com termos normalizados.
 */
function buildNormalizedConcatSql() {
  const concatParts = SEARCH_COLUMNS.map(
    (c) => `COALESCE(\`${c}\`,'')`
  ).join(", ");
  let expr = `LOWER(CONCAT_WS(' ', ${concatParts}))`;
  for (const prep of PREPOSICOES) {
    const sqlPrep = prep.replace(/'/g, "''");
    expr = `REPLACE(${expr}, '${sqlPrep}', ' ')`;
  }
  expr = `REPLACE(REPLACE(TRIM(${expr}), '  ', ' '), '  ', ' ')`;
  return expr;
}

/**
 * Lista produtos com busca concatenada e normalizada (q) e/ou filtro por observação.
 * @param {Object} options
 * @param {string} [options.q] - Texto de busca (vários termos); aplica normalização.
 * @param {string} [options.observacao] - Filtro exato por observação textual (correlatos fallback).
 * @param {number} [options.observacao_id] - Filtro por observacao_id (quando a coluna existir).
 * @param {number} [options.limit=50]
 * @param {number} [options.page=1]
 * @param {string} [options.sortBy=descricao]
 * @param {string} [options.sortDir=asc]
 * @returns {Promise<{ data: any[], total: number }>}
 */
export async function listProdutosWithSearch(options = {}) {
  const pool = getPool();
  const limit = Math.max(1, Math.min(1000, Number(options.limit) || 50));
  const page = Math.max(1, Number(options.page) || 1);
  const offset = (page - 1) * limit;
  const columns = await getProdutosColumns();
  const sortBy =
    columns.includes(options.sortBy) || SEARCH_COLUMNS.includes(options.sortBy) || options.sortBy === "id"
      ? options.sortBy
      : "descricao";
  const sortDir =
    String(options.sortDir || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

  const whereParts = [];
  const params = [];

  const terms = getSearchTerms(options.q);
  if (terms.length > 0) {
    const normalizedExpr = buildNormalizedConcatSql();
    terms.forEach((term) => {
      whereParts.push(`${normalizedExpr} LIKE ?`);
      params.push(`%${term}%`);
    });
  }

  if (options.observacao !== undefined && options.observacao !== null && options.observacao !== "") {
    whereParts.push("`observacao` = ?");
    params.push(String(options.observacao).trim());
  }

  const observacaoId = options.observacao_id !== undefined && options.observacao_id !== null && options.observacao_id !== "";
  if (observacaoId && columns.includes("observacao_id")) {
    whereParts.push("`observacao_id` = ?");
    params.push(Number(options.observacao_id));
  }

  const whereSql =
    whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  const dataSql = `
    SELECT *
    FROM \`produtos\`
    ${whereSql}
    ORDER BY \`${sortBy}\` ${sortDir}
    LIMIT ? OFFSET ?
  `;
  const countSql = `
    SELECT COUNT(*) AS total
    FROM \`produtos\`
    ${whereSql}
  `;

  const [rows] = await pool.query(dataSql, [...params, limit, offset]);
  const [[countRow]] = await pool.query(countSql, params);

  return {
    data: rows,
    total: Number(countRow.total),
  };
}

/**
 * Retorna produtos correlatos ao produto :id (mesma Observação: observacao_id ou observacao textual), excluindo o próprio.
 * @param {number} productId
 * @param {Object} options - limit, page, sortBy, sortDir
 * @returns {Promise<{ data: any[], total: number } | null>} null se produto não existir
 */
export async function listCorrelatos(productId, options = {}) {
  const pool = getPool();
  const id = Number(productId);
  const columns = await getProdutosColumns();
  const hasObservacaoId = columns.includes("observacao_id");

  const selectFields = hasObservacaoId
    ? "id, observacao, observacao_id"
    : "id, observacao";
  const [prodRows] = await pool.query(
    `SELECT ${selectFields} FROM \`produtos\` WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!prodRows.length) return null;

  const row = prodRows[0];
  const observacao = row.observacao;

  const limit = Math.max(1, Math.min(1000, Number(options.limit) || 50));
  const page = Math.max(1, Number(options.page) || 1);
  const offset = (page - 1) * limit;
  const sortBy =
    columns.includes(options.sortBy) || SEARCH_COLUMNS.includes(options.sortBy) || options.sortBy === "id"
      ? options.sortBy
      : "descricao";
  const sortDir =
    String(options.sortDir || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

  let whereSql;
  let params;
  if (hasObservacaoId && row.observacao_id != null) {
    whereSql = "WHERE `observacao_id` = ? AND `id` != ?";
    params = [row.observacao_id, id];
  } else if (observacao != null && observacao !== "") {
    whereSql = "WHERE `observacao` = ? AND `id` != ?";
    params = [observacao, id];
  } else {
    return { data: [], total: 0 };
  }

  const dataSql = `
    SELECT *
    FROM \`produtos\`
    ${whereSql}
    ORDER BY \`${sortBy}\` ${sortDir}
    LIMIT ? OFFSET ?
  `;
  const countSql = `
    SELECT COUNT(*) AS total
    FROM \`produtos\`
    ${whereSql}
  `;

  const [rows] = await pool.query(dataSql, [...params, limit, offset]);
  const [[countRow]] = await pool.query(countSql, params);

  return {
    data: rows,
    total: Number(countRow.total),
  };
}
