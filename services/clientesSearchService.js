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

/** Sinônimos para normalização */
const SINONIMOS = {
  municipio: ["prefeitura", "municipio", "município"],
  prefeitura: ["prefeitura", "municipio", "município"],
};

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
  
  // Trata sinônimos (municipio/prefeitura)
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
 */
function buildNormalizedConcatSql() {
  // Campos de busca: nome (fantasia/razao_social), telefone, email, municipio
  const searchColumns = [
    "fantasia",
    "razao_social",
    "telefone",
    "celular",
    "email",
    "municipio",
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
  
  // Trata sinônimos (municipio/prefeitura)
  // Substitui "prefeitura" e "município" por "municipio" para normalização
  expr = `REPLACE(REPLACE(${expr}, 'prefeitura', 'municipio'), 'município', 'municipio')`;
  
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
 * Busca em: nome (fantasia/razao_social), telefone (telefone/celular), email, municipio.
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
  const validSortColumns = ["id", "fantasia", "razao_social", "municipio", "email", "telefone", "celular"];
  const sortBy = validSortColumns.includes(options.sortBy) ? options.sortBy : "fantasia";
  const sortDir =
    String(options.sortDir || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

  const whereParts = [];
  const params = [];

  const q = options.q ? String(options.q).trim() : "";
  if (q) {
    const terms = getSearchTerms(q);
    
    if (terms.length > 0) {
      // Se o termo parece ser telefone, busca em telefone/celular
      const isPhone = isPhoneTerm(q);
      // Se o termo parece ser email, busca em email
      const isEmail = isEmailTerm(q);
      
      // Busca normalizada sempre aplicada (nome, municipio, telefone, email)
      // Isso permite encontrar "bonito" tanto no nome quanto no municipio
      const normalizedExpr = buildNormalizedConcatSql();
      const searchConditions = [];
      
      // Adiciona busca normalizada para todos os termos
      terms.forEach((term) => {
        searchConditions.push(`${normalizedExpr} LIKE ?`);
        params.push(`%${term}%`);
      });
      
      // Se parece ser telefone, adiciona busca específica em telefone/celular
      if (isPhone) {
        const phoneDigits = q.replace(/\D/g, "");
        searchConditions.push(
          `(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(\`telefone\`,''), ' ', ''), '-', ''), '(', ''), ')', '') LIKE ? OR REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(\`celular\`,''), ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?)`
        );
        params.push(`%${phoneDigits}%`, `%${phoneDigits}%`);
      }
      
      // Se parece ser email, adiciona busca específica em email
      if (isEmail) {
        searchConditions.push(`LOWER(\`email\`) LIKE ?`);
        params.push(`%${q.toLowerCase()}%`);
      }
      
      // Combina todas as condições com OR (busca em qualquer campo)
      if (searchConditions.length > 0) {
        whereParts.push(`(${searchConditions.join(" OR ")})`);
      }
    }
  }

  const whereSql =
    whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  const dataSql = `
    SELECT *
    FROM \`clientes\`
    ${whereSql}
    ORDER BY \`${sortBy}\` ${sortDir}
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
