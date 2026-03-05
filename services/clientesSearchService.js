import { getPool } from "../db.js";

/** Cache das colunas da tabela clientes */
let clientesColumnsCache = null;

async function getClientesColumns() {
  if (clientesColumnsCache) return clientesColumnsCache;
  const pool = getPool();
  const [rows] = await pool.query("SHOW COLUMNS FROM `clientes`");
  clientesColumnsCache = rows.map((r) => r.Field);
  return clientesColumnsCache;
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
  " um ",
  " uma ",
  " por ",
  " para ",
  " com ",
  " sem ",
];

/** Sinônimos para normalização (vazio - município não entra na busca por q) */
const SINONIMOS = {};

/** Remove acentos para busca case/accent-insensitive */
function unaccent(str) {
  if (typeof str !== "string") return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Expressão SQL para normalizar acentos em coluna (MySQL) */
function accentNormalizeSql(col) {
  return `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(COALESCE(\`${col}\`, '')), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ã','a'), 'ç','c')`;
}

/**
 * Normaliza texto para busca: lowercase, remove preposições, trata sinônimos, colapsa espaços.
 * @param {string} text
 * @returns {string}
 */
export function normalizeSearchText(text) {
  if (typeof text !== "string") return "";
  let t = text.trim().toLowerCase();
  
  // Remove preposições
  for (const prep of PREPOSICOES) {
    t = t.split(prep).join(" ");
  }
  
  // Trata sinônimos (se houver)
  for (const [key, synonyms] of Object.entries(SINONIMOS)) {
    for (const synonym of synonyms) {
      // Substitui sinônimos pela palavra-chave principal
      const regex = new RegExp(`\\b${synonym}\\b`, "gi");
      if (regex.test(t)) {
        t = t.replace(regex, key);
      }
    }
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
 * (LOWER + CONCAT_WS + REPLACE das preposições e sinônimos).
 * Usado para comparar com termos normalizados.
 * 
 * Campos de busca: Nome/Fantasia, Razão Social, CPF/CNPJ, Contato (telefone/celular/email)
 * NÃO inclui endereço/município conforme solicitado.
 */
function buildNormalizedConcatSql() {
  // Campos de busca: cliente (nome), fantasia, razao_social, cpf_cnpj, telefone, celular, email
  const searchColumns = [
    "cliente",        // Nome/Fantasia
    "fantasia",       // Nome/Fantasia
    "razao_social",   // Razão Social
    "cpf_cnpj",       // CPF/CNPJ
    "telefone",       // Contato
    "celular",        // Contato
    "email",          // Contato
  ];
  
  const concatParts = searchColumns
    .map((c) => `COALESCE(\`${c}\`,'')`)
    .join(", ");
  let expr = `LOWER(CONCAT_WS(' ', ${concatParts}))`;
  
  // Remove preposições
  for (const prep of PREPOSICOES) {
    const sqlPrep = prep.replace(/'/g, "''");
    expr = `REPLACE(${expr}, '${sqlPrep}', ' ')`;
  }
  
  // Colapsa espaços múltiplos
  expr = `REPLACE(REPLACE(TRIM(${expr}), '  ', ' '), '  ', ' ')`;
  
  return expr;
}

/**
 * Verifica se o termo de busca parece ser um telefone (contém apenas números e caracteres comuns de telefone)
 * @param {string} term
 * @returns {boolean}
 */
function isPhoneTerm(term) {
  // Remove espaços, parênteses, hífens e outros caracteres comuns de telefone
  const cleaned = term.replace(/[\s\-\(\)\.]/g, "");
  // Se após limpar tem pelo menos 8 dígitos e é principalmente numérico, é telefone
  return cleaned.length >= 8 && /^\d+$/.test(cleaned);
}

/**
 * Verifica se o termo de busca parece ser um email
 * @param {string} term
 * @returns {boolean}
 */
function isEmailTerm(term) {
  return term.includes("@") && term.includes(".");
}

/**
 * Lista clientes com busca inteligente normalizada (q).
 * Busca em: Nome/Fantasia (cliente, fantasia), Razão Social (razao_social), CPF/CNPJ (cpf_cnpj), Contato (telefone, celular, email), Município.
 * Inclui município para encontrar pessoas que são do município mesmo sem o termo no nome.
 * Busca é case-insensitive (não diferencia maiúsculas/minúsculas).
 * Ordenação: primeiro pessoas jurídicas (tipo_pessoa = 'J'), depois pessoas físicas (tipo_pessoa = 'F'), ordenadas por fantasia/razao_social.
 * @param {Object} options
 * @param {string} [options.q] - Texto de busca (vários termos); aplica normalização.
 * @param {number} [options.limit=20]
 * @param {number} [options.page=1]
 * @param {string} [options.sortBy=fantasia]
 * @param {string} [options.sortDir=asc]
 * @returns {Promise<{ data: any[], total: number }>}
 */
export async function listClientesWithSearch(options = {}) {
  const pool = getPool();
  const limit = Math.max(1, Math.min(1000, Number(options.limit) || 20));
  const page = Math.max(1, Number(options.page) || 1);
  const offset = (page - 1) * limit;
  const columns = await getClientesColumns();
  
  // Campos válidos para ordenação
  const validSortColumns = ["id", "cliente", "fantasia", "razao_social", "cpf_cnpj", "email", "telefone", "celular"];
  const sortBy = validSortColumns.includes(options.sortBy) ? options.sortBy : "fantasia";
  const sortDir =
    String(options.sortDir || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

  const whereParts = [];
  const params = [];

  const q = options.q ? String(options.q).trim() : "";
  if (q) {
    // Termo normalizado: sem acentos, lowercase, trim. NÃO remove preposições (ex: "de", "da")
    // pois isso quebra o match (ex: "fundo municipal de saúde" vira "fundo municipal saúde"
    // e não encontra "fundo municipal de saúde" no banco)
    const searchTerm = unaccent(q).toLowerCase().trim();
    if (searchTerm.length > 0) {
      // Campos de busca: cliente (nome), fantasia, razao_social, cpf_cnpj, telefone, celular, email
      // Município NÃO entra na busca por q (usar filtro dedicado municipio)
      const searchFields = ["cliente", "fantasia", "razao_social", "cpf_cnpj", "telefone", "celular", "email"];
      const availableFields = searchFields.filter((f) => columns.includes(f));

      const conditions = [];
      for (const f of availableFields) {
        conditions.push(`${accentNormalizeSql(f)} LIKE ?`);
      }

      // CPF/CNPJ: busca também sem máscara (só dígitos) - inclui no OR principal
      const cpfCnpjDigits = q.replace(/\D/g, "");
      if (cpfCnpjDigits.length >= 11 && columns.includes("cpf_cnpj")) {
        conditions.push(`(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(\`cpf_cnpj\`, ''), '.', ''), '/', ''), '-', ''), ' ', '') LIKE ?)`);
      }

      if (conditions.length > 0) {
        whereParts.push(`(${conditions.join(" OR ")})`);
        availableFields.forEach(() => params.push(`%${searchTerm}%`));
        if (cpfCnpjDigits.length >= 11 && columns.includes("cpf_cnpj")) {
          params.push(`%${cpfCnpjDigits}%`);
        }
      }
    }
  }

  // Filtros dedicados (combinados com AND)
  if (options.tipo_pessoa) {
    whereParts.push("`tipo_pessoa` = ?");
    params.push(String(options.tipo_pessoa).trim().toUpperCase().slice(0, 1));
  }
  if (options.municipio) {
    whereParts.push("LOWER(COALESCE(`municipio`, '')) LIKE ?");
    params.push(`%${String(options.municipio).trim().toLowerCase()}%`);
  }
  if (options.uf) {
    whereParts.push("UPPER(TRIM(COALESCE(`uf`, ''))) = ?");
    params.push(String(options.uf).trim().toUpperCase().slice(0, 2));
  }

  const whereSql =
    whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  // Ordenação: primeiro por tipo_pessoa (J primeiro, depois F), depois por fantasia/razao_social
  // Pessoas jurídicas (J) aparecem primeiro, depois pessoas físicas (F)
  // Dentro de cada grupo, ordena por fantasia (ou razao_social se fantasia vazio)
  const orderBy = `
    ORDER BY 
      CASE WHEN \`tipo_pessoa\` = 'J' THEN 0 ELSE 1 END ASC,
      COALESCE(NULLIF(\`fantasia\`, ''), \`razao_social\`, \`cliente\`) ASC
  `;

  const dataSql = `
    SELECT *
    FROM \`clientes\`
    ${whereSql}
    ${orderBy}
    LIMIT ? OFFSET ?
  `;
  const countSql = `
    SELECT COUNT(*) AS total
    FROM \`clientes\`
    ${whereSql}
  `;

  const [rows] = await pool.query(dataSql, [...params, limit, offset]);
  const [[countRow]] = await pool.query(countSql, params);

  return {
    data: rows,
    total: Number(countRow.total),
  };
}
