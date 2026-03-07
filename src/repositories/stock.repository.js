import { db } from "../config/database.js";
import { XMLParser } from "fast-xml-parser";

/**
 * Retorna mapa de qty_blocked por (product_id, empresa_id).
 * Bloqueado = itens em pedidos_compra com orcamento_id, status != Recebido/Cancelado
 */
export async function getQtyBlockedMap() {
  try {
    const [[{ hasCol }]] = await db.query(
      `SELECT COUNT(*) > 0 AS hasCol FROM information_schema.COLUMNS
       WHERE table_schema = DATABASE() AND table_name = 'pedidos_compra' AND column_name = 'orcamento_id'`
    );
    if (!hasCol) return new Map();

    const [rows] = await db.query(
      `SELECT empresa_id, json_itens FROM pedidos_compra
       WHERE orcamento_id IS NOT NULL AND status NOT IN ('Recebido', 'Cancelado')`
    );

    const map = new Map();
    for (const r of rows) {
      const empresaId = Number(r.empresa_id);
      let itens = r.json_itens;
      if (typeof itens === "string") {
        try {
          itens = JSON.parse(itens || "[]");
        } catch {
          continue;
        }
      }
      if (!Array.isArray(itens)) continue;
      for (const it of itens) {
        const produtoId = Number(it?.produto_id ?? it?.product_id);
        const qty = Number(it?.quantidade ?? it?.quantity) || 0;
        if (!produtoId || qty <= 0) continue;
        const key = `${produtoId}-${empresaId}`;
        map.set(key, (map.get(key) || 0) + qty);
      }
    }
    return map;
  } catch (e) {
    if (e.code !== "ER_NO_SUCH_TABLE") console.warn("[stock] getQtyBlockedMap:", e.message);
    return new Map();
  }
}

/**
 * Retorna IDs de produtos que correspondem à busca q incluindo triangularização (vínculos)
 */
async function getProdutoIdsComVinculados(q) {
  const term = `%${String(q).trim()}%`;
  const [direct] = await db.query(
    `SELECT id FROM produtos WHERE codigo_produto LIKE ? OR codigo_empresa LIKE ? OR descricao LIKE ? OR codigo_fabrica LIKE ? OR observacao LIKE ?`,
    [term, term, term, term, term]
  );
  const ids = new Set(direct.map((r) => r.id));

  try {
    const { VinculosRepository } = await import("./vinculos.repository.js");
    for (const r of direct) {
      const similares = await VinculosRepository.getSimilaresByProdutoId(r.id);
      similares.forEach((p) => ids.add(p.id));
    }
  } catch (e) {
    if (e.code !== "ER_NO_SUCH_TABLE") console.warn("[stock] vinculos:", e.message);
  }
  return Array.from(ids);
}

/**
 * Repositório para operações de Estoque (por empresa/loja)
 */
export class StockRepository {
  /**
   * Busca saldos de estoque (espelho completo: TODOS os produtos × empresas)
   * Suporta: productId, empresa_id, q, fabrica_id, incluir_sem_vinculo, sortBy, sortDir, page, limit
   */
  static async getBalances(filters = {}) {
    const {
      productId,
      empresa_id,
      q,
      fabrica_id,
      incluir_sem_vinculo,
      sortBy = "product_name",
      sortDir = "asc",
      limit = 2000,
      offset = 0,
    } = filters;

    const whereParts = [];
    const params = [];

    if (productId) {
      whereParts.push("p.id = ?");
      params.push(productId);
    }

    if (empresa_id != null && empresa_id !== "") {
      whereParts.push("e.id = ?");
      params.push(Number(empresa_id));
    }

    if (q && String(q).trim()) {
      const ids = await getProdutoIdsComVinculados(q);
      if (ids.length === 0) {
        return { data: [], total: 0 };
      }
      const placeholders = ids.map(() => "?").join(",");
      whereParts.push(`p.id IN (${placeholders})`);
      params.push(...ids);
    }

    // Filtro por fábrica: fabrica_id (array) e/ou incluir_sem_vinculo
    const fabricaIds = Array.isArray(fabrica_id)
      ? fabrica_id.map((id) => Number(id)).filter((id) => id > 0)
      : typeof fabrica_id === "string" && fabrica_id
        ? fabrica_id.split(",").map((id) => Number(id.trim())).filter((id) => id > 0)
        : [];
    const incluirSemVinculo = incluir_sem_vinculo === true || incluir_sem_vinculo === "true" || incluir_sem_vinculo === "1";

    if (fabricaIds.length > 0 || incluirSemVinculo) {
      try {
        const [[{ pfExists }]] = await db.query(
          `SELECT COUNT(*) > 0 AS pfExists FROM information_schema.tables
           WHERE table_schema = DATABASE() AND table_name = 'produto_fabrica'`
        );
        const [[{ fExists }]] = await db.query(
          `SELECT COUNT(*) > 0 AS fExists FROM information_schema.tables
           WHERE table_schema = DATABASE() AND table_name = 'fabricas'`
        );

        const conds = [];
        if (fabricaIds.length > 0 && pfExists) {
          const ph = fabricaIds.map(() => "?").join(",");
          conds.push(`p.id IN (SELECT produto_id FROM produto_fabrica WHERE fabrica_id IN (${ph}))`);
          params.push(...fabricaIds);
        }
        if (fabricaIds.length > 0 && fExists) {
          const ph = fabricaIds.map(() => "?").join(",");
          conds.push(`p.id IN (SELECT p2.id FROM produtos p2 INNER JOIN fabricas f ON p2.codigo_fabrica = f.codigo AND f.id IN (${ph}))`);
          params.push(...fabricaIds);
        }
        if (incluirSemVinculo) {
          if (pfExists && fExists) {
            conds.push(`(p.id NOT IN (SELECT produto_id FROM produto_fabrica)
              AND (p.codigo_fabrica IS NULL OR p.codigo_fabrica = '' OR p.id NOT IN (
                SELECT p2.id FROM produtos p2 INNER JOIN fabricas f ON p2.codigo_fabrica = f.codigo
              )))`);
          } else if (pfExists) {
            conds.push(`p.id NOT IN (SELECT produto_id FROM produto_fabrica)`);
          } else {
            conds.push(`(p.codigo_fabrica IS NULL OR p.codigo_fabrica = '')`);
          }
        }
        if (conds.length > 0) {
          whereParts.push(`(${conds.join(" OR ")})`);
        }
      } catch (e) {
        if (e.code !== "ER_NO_SUCH_TABLE") console.warn("[stock] fabrica filter:", e.message);
      }
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    // Ordenação: sortBy (total_fisico, total_disponivel, qty_on_hand, etc.) e sortDir
    const sortDirSql = String(sortDir).toLowerCase() === "desc" ? "DESC" : "ASC";
    let orderBy = "p.descricao, e.nome_fantasia";

    const totalSortMap = {
      total_fisico: `(SELECT COALESCE(SUM(si2.qty_on_hand), 0) FROM stock_items si2 WHERE si2.product_id = p.id)`,
      total_disponivel: `(SELECT COALESCE(SUM(si2.qty_on_hand - COALESCE(si2.qty_reserved,0)), 0) FROM stock_items si2 WHERE si2.product_id = p.id)`,
      total_reservado: `(SELECT COALESCE(SUM(si2.qty_reserved), 0) FROM stock_items si2 WHERE si2.product_id = p.id)`,
      total_em_orcamento: `(SELECT COALESCE(SUM(si2.qty_in_budget), 0) FROM stock_items si2 WHERE si2.product_id = p.id)`,
    };
    const colSortMap = {
      product_id: "p.id",
      product_code: "p.codigo_produto",
      product_factory_code: "p.codigo_fabrica",
      product_name: "p.descricao",
      empresa_id: "e.id",
      empresa_nome: "e.nome_fantasia",
      qty_on_hand: "COALESCE(si.qty_on_hand, 0)",
      qty_reserved: "COALESCE(si.qty_reserved, 0)",
      qty_in_budget: "COALESCE(si.qty_in_budget, 0)",
      qty_available: "(COALESCE(si.qty_on_hand, 0) - COALESCE(si.qty_reserved, 0))",
    };

    const qtyEmpresaMatch = /^qty_empresa_(\d+)$/.exec(sortBy);
    if (qtyEmpresaMatch) {
      const empId = Number(qtyEmpresaMatch[1]);
      orderBy = `(SELECT COALESCE(si2.qty_on_hand, 0) FROM stock_items si2 WHERE si2.product_id = p.id AND si2.empresa_id = ${empId}) ${sortDirSql}, p.descricao, e.nome_fantasia`;
    } else if (totalSortMap[sortBy]) {
      orderBy = `${totalSortMap[sortBy]} ${sortDirSql}, p.descricao, e.nome_fantasia`;
    } else if (colSortMap[sortBy]) {
      orderBy = `${colSortMap[sortBy]} ${sortDirSql}, p.descricao, e.nome_fantasia`;
    }

    const [rows] = await db.query(
      `SELECT p.id AS product_id,
              e.id AS empresa_id,
              p.codigo_produto AS product_code,
              p.codigo_fabrica AS product_factory_code,
              COALESCE(p.descricao, '') AS product_name,
              p.observacao AS descricao,
              COALESCE(e.nome_fantasia, e.razao_social, '') AS empresa_nome,
              p.preco_custo AS preco_compra,
              p.preco_sugerido AS preco_sugerido,
              COALESCE(si.qty_on_hand, 0) AS qty_on_hand,
              COALESCE(si.qty_reserved, 0) AS qty_reserved,
              COALESCE(si.qty_in_budget, 0) AS qty_in_budget
       FROM produtos p
       CROSS JOIN empresas e
       LEFT JOIN stock_items si ON si.product_id = p.id AND si.empresa_id = e.id
       ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, Number(limit) || 2000, Number(offset) || 0]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM produtos p
       CROSS JOIN empresas e
       LEFT JOIN stock_items si ON si.product_id = p.id AND si.empresa_id = e.id
       ${whereSql}`,
      params
    );

    const blockedMap = await getQtyBlockedMap();
    const data = rows.map((r) => {
      const qtyBlocked = blockedMap.get(`${r.product_id}-${r.empresa_id}`) || 0;
      const qtyAvailable = Math.max(0, Number(r.qty_on_hand) - Number(r.qty_reserved) - qtyBlocked);
      return {
        ...r,
        qty_blocked: qtyBlocked,
        qty_available: qtyAvailable,
      };
    });

    return { data, total: countRow?.total ?? 0 };
  }

  /**
   * Busca movimentações de estoque
   */
  static async getMovements(filters = {}) {
    const {
      productId,
      empresa_id,
      type,
      refType,
      refId,
      limit = 100,
      offset = 0,
    } = filters;

    const whereParts = [];
    const params = [];

    if (productId) {
      whereParts.push("sm.product_id = ?");
      params.push(productId);
    }

    if (empresa_id != null && empresa_id !== "") {
      whereParts.push("sm.empresa_id = ?");
      params.push(Number(empresa_id));
    }

    if (type) {
      whereParts.push("sm.type = ?");
      params.push(type);
    }

    if (refType) {
      whereParts.push("sm.ref_type = ?");
      params.push(refType);
    }

    if (refId) {
      whereParts.push("sm.ref_id = ?");
      params.push(refId);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT sm.id, sm.product_id, sm.empresa_id, sm.type, sm.qty, sm.qty_before, sm.qty_after,
              sm.ref_type, sm.ref_id, sm.notes, sm.created_by, sm.created_at,
              p.descricao AS product_name, p.codigo_produto AS product_code,
              COALESCE(e.nome_fantasia, e.razao_social) AS empresa_nome,
              u.name AS created_by_name
       FROM stock_movements sm
       LEFT JOIN produtos p ON sm.product_id = p.id
       LEFT JOIN empresas e ON sm.empresa_id = e.id
       LEFT JOIN users u ON sm.created_by = u.id
       ${whereSql}
       ORDER BY sm.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM stock_movements sm ${whereSql}`,
      params
    );

    return { data: rows, total: countRow.total };
  }

  /**
   * Cria movimentação de estoque (usa empresa_id)
   */
  static async createMovement(data) {
    const {
      product_id,
      empresa_id,
      type,
      qty,
      ref_type,
      ref_id,
      notes,
      created_by,
    } = data;

    const empId = empresa_id != null ? Number(empresa_id) : 1;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [balanceRows] = await connection.query(
        "SELECT qty_on_hand, qty_reserved FROM stock_items WHERE product_id = ? AND empresa_id = ?",
        [product_id, empId]
      );

      const currentBalance = balanceRows[0] || {
        qty_on_hand: 0,
        qty_reserved: 0,
      };
      const qtyBefore = currentBalance.qty_on_hand;
      let qtyAfter = qtyBefore;

      if (type === "ENTRY" || type === "ADJUSTMENT") {
        qtyAfter = qtyBefore + qty;
        await connection.query(
          `INSERT INTO stock_items (product_id, empresa_id, qty_on_hand, qty_reserved, qty_in_budget)
           VALUES (?, ?, ?, 0, 0)
           ON DUPLICATE KEY UPDATE qty_on_hand = qty_on_hand + ?`,
          [product_id, empId, qty, qty]
        );
      } else if (type === "EXIT") {
        qtyAfter = qtyBefore - qty;
        await connection.query(
          `UPDATE stock_items 
           SET qty_on_hand = qty_on_hand - ?
           WHERE product_id = ? AND empresa_id = ?`,
          [qty, product_id, empId]
        );
      }

      const [result] = await connection.query(
        `INSERT INTO stock_movements 
         (product_id, empresa_id, type, qty, qty_before, qty_after, ref_type, ref_id, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product_id,
          empId,
          type,
          qty,
          qtyBefore,
          qtyAfter,
          ref_type || null,
          ref_id || null,
          notes || null,
          created_by || null,
        ]
      );

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Verifica disponibilidade de produto por empresa.
   * Disponível = Total - Reservado - Bloqueado
   */
  static async checkAvailability(productId, qty, empresaId = 1) {
    const empId = Number(empresaId) || 1;
    const [rows] = await db.query(
      `SELECT qty_on_hand, qty_reserved, COALESCE(qty_in_budget, 0) AS qty_in_budget
       FROM stock_items
       WHERE product_id = ? AND empresa_id = ?`,
      [productId, empId]
    );

    const balance = rows[0] || { qty_on_hand: 0, qty_reserved: 0, qty_in_budget: 0 };
    const blockedMap = await getQtyBlockedMap();
    const qtyBlocked = blockedMap.get(`${productId}-${empId}`) || 0;
    const qtyAvailable = Math.max(0, Number(balance.qty_on_hand) - Number(balance.qty_reserved) - qtyBlocked);

    return {
      available: qtyAvailable >= Number(qty),
      qtyAvailable,
      qtyOnHand: balance.qty_on_hand,
      qtyReserved: balance.qty_reserved,
    };
  }

  /**
   * Verifica disponibilidade estendida: por empresa, supply_action, total_available.
   * Disponível = Total - Reservado - Bloqueado
   */
  static async getAvailabilityExtended(productId, qty, empresaId) {
    const [rows] = await db.query(
      `SELECT e.id AS empresa_id,
              COALESCE(si.qty_on_hand, 0) AS qty_on_hand,
              COALESCE(si.qty_reserved, 0) AS qty_reserved,
              COALESCE(si.qty_in_budget, 0) AS qty_in_budget,
              COALESCE(e.nome_fantasia, e.razao_social) AS empresa_nome
       FROM empresas e
       LEFT JOIN stock_items si ON si.product_id = ? AND si.empresa_id = e.id`,
      [productId]
    );

    const blockedMap = await getQtyBlockedMap();
    const byEmpresa = rows.map((r) => {
      const qtyBlocked = blockedMap.get(`${productId}-${r.empresa_id}`) || 0;
      const qtyAvailable = Math.max(0, Number(r.qty_on_hand) - Number(r.qty_reserved) - qtyBlocked);
      return {
        empresa_id: r.empresa_id,
        empresa_nome: r.empresa_nome,
        qty_available: qtyAvailable,
        qty_on_hand: Number(r.qty_on_hand),
        qty_reserved: Number(r.qty_reserved),
        qty_in_budget: Number(r.qty_in_budget),
      };
    });

    const totalAvailable = byEmpresa.reduce((sum, e) => sum + e.qty_available, 0);
    const requestedQty = Number(qty) || 0;
    const empId = empresaId != null ? Number(empresaId) : null;

    let supplyAction = null;
    let empresaWithStockId = null;

    const inEmissora = byEmpresa.find((e) => e.empresa_id === empId);
    const availEmissora = inEmissora ? inEmissora.qty_available : 0;

    if (availEmissora >= requestedQty) {
      supplyAction = "in_stock";
      empresaWithStockId = empId;
    } else if (totalAvailable >= requestedQty) {
      supplyAction = "needs_transfer";
      empresaWithStockId = byEmpresa.find((e) => e.qty_available >= requestedQty)?.empresa_id || byEmpresa[0]?.empresa_id;
    } else {
      supplyAction = "needs_purchase";
    }

    return {
      available: totalAvailable >= requestedQty,
      by_empresa: byEmpresa,
      supply_action: supplyAction,
      empresa_with_stock_id: empresaWithStockId,
      total_available: totalAvailable,
    };
  }

  /**
   * Orçamentos que possuem o produto (para GET /stock/balances/:productId/orcamentos)
   */
  static async getOrcamentosByProduct(productId, limit = 50) {
    const [rows] = await db.query(
      `SELECT o.id, o.numero_sequencial, o.status, o.empresa_id, o.veiculo_id, o.json_itens,
              COALESCE(e.nome_fantasia, e.razao_social) AS empresa_nome,
              v.placa AS veiculo_placa
       FROM orcamentos o
       LEFT JOIN empresas e ON o.empresa_id = e.id
       LEFT JOIN veiculos v ON o.veiculo_id = v.id
       WHERE o.status NOT IN ('Finalizado', 'Cancelado')
         AND o.json_itens IS NOT NULL
         AND o.json_itens != '[]'
       ORDER BY o.id DESC
       LIMIT ?`,
      [limit]
    );

    const prodId = Number(productId);
    const filtered = rows.filter((r) => {
      try {
        const itens = typeof r.json_itens === "string" ? JSON.parse(r.json_itens) : r.json_itens;
        return Array.isArray(itens) && itens.some((i) => Number(i?.produto_id) === prodId);
      } catch {
        return false;
      }
    });

    return filtered.map((r) => {
      let quantidade = 0;
      try {
        const itens = typeof r.json_itens === "string" ? JSON.parse(r.json_itens) : r.json_itens;
        if (Array.isArray(itens)) {
          const item = itens.find((i) => Number(i?.produto_id) === Number(productId));
          quantidade = item ? Number(item.quantidade || 0) : 0;
        }
      } catch {}
      return {
        id: r.id,
        empresa_id: r.empresa_id,
        numero_sequencial: r.numero_sequencial,
        empresa_nome: r.empresa_nome,
        veiculo_placa: r.veiculo_placa,
        quantidade,
        status: r.status,
      };
    });
  }

  /**
   * Busca produto por código de barras (codigo_barra)
   */
  static async getProductByBarcode(barcode) {
    const code = String(barcode || "").trim();
    if (!code) return null;
    const [rows] = await db.query(
      `SELECT id, codigo_produto AS codigo, codigo_empresa, codigo_barra AS codigo_barras,
              codigo_fabrica, descricao AS nome, descricao, unidade, preco_custo
       FROM produtos
       WHERE codigo_barra = ? OR codigo_barra = TRIM(?)
       LIMIT 1`,
      [code, code]
    );
    return rows[0] || null;
  }

  /**
   * Busca produto por código (codigo_produto, codigo_fabrica ou codigo_barra)
   */
  static async findProductByCode(code) {
    const c = String(code || "").trim();
    if (!c) return null;
    const [rows] = await db.query(
      `SELECT id FROM produtos
       WHERE codigo_produto = ? OR codigo_fabrica = ? OR codigo_barra = ?
       LIMIT 1`,
      [c, c, c]
    );
    return rows[0] ? rows[0].id : null;
  }

  /**
   * Importa XML (pedido/NF) e cria entradas de estoque por empresa_id
   * Extrai itens com codigo/cProd/codigoProduto e quantidade/qCom/qtd; associa ao produto e dá entrada.
   */
  static async importXmlEntries(empresa_id, xmlContent, created_by = null) {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
    });
    let obj;
    try {
      obj = parser.parse(xmlContent);
    } catch (e) {
      throw new Error("XML inválido ou malformado");
    }

    const items = collectItemsFromXml(obj);
    if (items.length === 0) {
      return { imported: 0, errors: ["Nenhum item encontrado no XML"], entries: [] };
    }

    const connection = await db.getConnection();
    const entries = [];
    const errors = [];

    try {
      await connection.beginTransaction();

      for (const it of items) {
        const code = it.codigo || it.cProd || it.codigoProduto || it.codigo_produto;
        const qty = parseFloat(it.quantidade || it.qCom || it.qtd || it.quantidadeCom || 1) || 1;
        if (!code) {
          errors.push(`Item sem código ignorado`);
          continue;
        }

        const [prodRows] = await connection.query(
          `SELECT id FROM produtos WHERE codigo_produto = ? OR codigo_fabrica = ? OR codigo_barra = ? LIMIT 1`,
          [String(code).trim(), String(code).trim(), String(code).trim()]
        );
        const productId = prodRows[0]?.id;
        if (!productId) {
          errors.push(`Produto não encontrado para código: ${code}`);
          continue;
        }

        const [balRows] = await connection.query(
          "SELECT qty_on_hand FROM stock_items WHERE product_id = ? AND empresa_id = ?",
          [productId, empresa_id]
        );
        const qtyBefore = balRows[0]?.qty_on_hand ?? 0;
        const qtyAfter = qtyBefore + qty;

        await connection.query(
          `INSERT INTO stock_items (product_id, empresa_id, qty_on_hand, qty_reserved, qty_in_budget)
           VALUES (?, ?, ?, 0, 0)
           ON DUPLICATE KEY UPDATE qty_on_hand = qty_on_hand + ?`,
          [productId, empresa_id, qty, qty]
        );
        const [ins] = await connection.query(
          `INSERT INTO stock_movements (product_id, empresa_id, type, qty, qty_before, qty_after, ref_type, notes, created_by)
           VALUES (?, ?, 'ENTRY', ?, ?, ?, 'import_xml', ?, ?)`,
          [productId, empresa_id, qty, qtyBefore, qtyAfter, `XML: ${code}`, created_by]
        );
        entries.push({ product_id: productId, code, quantity: qty, movement_id: ins.insertId });
      }

      await connection.commit();
      return { imported: entries.length, errors: errors.length ? errors : undefined, entries };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}

/**
 * Extrai itens de um objeto parseado de XML (NF-e, pedido, etc.)
 * Suporta: det[].prod (cProd, qCom), item (codigo, quantidade), itens[], etc.
 */
function collectItemsFromXml(node, out = []) {
  if (!node || typeof node !== "object") return out;

  if (Array.isArray(node)) {
    node.forEach((n) => collectItemsFromXml(n, out));
    return out;
  }

  const prod = node.prod || node.produto;
  const base = prod && typeof prod === "object" ? prod : node;

  const codigo = base.codigo ?? base.cProd ?? base.codigoProduto ?? base.codigo_produto;
  const qtd = base.quantidade ?? base.qCom ?? base.qtd ?? base.quantidadeCom ?? base.vQCom;
  if (codigo != null) {
    const q = parseFloat(qtd) || 1;
    out.push({
      codigo: String(codigo).trim(),
      cProd: base.cProd,
      codigoProduto: base.codigoProduto,
      codigo_produto: base.codigo_produto,
      quantidade: q,
      qCom: base.qCom,
      qtd: base.qtd,
      quantidadeCom: base.quantidadeCom,
    });
    return out;
  }

  for (const key of Object.keys(node)) {
    const v = node[key];
    if (key === "det" || key === "item" || key === "itens" || key === "prod" || key === "produto") {
      collectItemsFromXml(v, out);
    } else if (typeof v === "object" && v !== null) {
      collectItemsFromXml(v, out);
    }
  }
  return out;
}
