import { db } from "../config/database.js";
import { XMLParser } from "fast-xml-parser";

/**
 * Repositório para operações de Estoque (por empresa/loja)
 */
export class StockRepository {
  /**
   * Busca saldos de estoque (por produto e por empresa)
   * Suporta q (busca por código, descrição, codigo_fabrica), productId, empresa_id, page, limit
   */
  static async getBalances(filters = {}) {
    const { productId, empresa_id, q, limit = 2000, offset = 0 } = filters;
    const whereParts = [];
    const params = [];

    if (productId) {
      whereParts.push("sb.product_id = ?");
      params.push(productId);
    }

    if (empresa_id != null && empresa_id !== "") {
      whereParts.push("sb.empresa_id = ?");
      params.push(Number(empresa_id));
    }

    if (q && String(q).trim()) {
      const term = `%${String(q).trim()}%`;
      whereParts.push("(p.codigo_produto LIKE ? OR p.codigo_empresa LIKE ? OR p.descricao LIKE ? OR p.codigo_fabrica LIKE ?)");
      params.push(term, term, term, term);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT sb.product_id,
              sb.empresa_id,
              sb.qty_on_hand,
              sb.qty_reserved,
              COALESCE(sb.qty_pending_nf, 0) AS qty_pending_nf,
              sb.qty_available,
              p.codigo_produto AS product_code,
              p.codigo_fabrica AS product_factory_code,
              p.descricao AS product_name,
              COALESCE(e.nome_fantasia, e.razao_social, '') AS empresa_nome
       FROM stock_balances sb
       INNER JOIN produtos p ON sb.product_id = p.id
       LEFT JOIN empresas e ON sb.empresa_id = e.id
       ${whereSql}
       ORDER BY p.descricao, e.nome_fantasia
       LIMIT ? OFFSET ?`,
      [...params, Number(limit) || 2000, Number(offset) || 0]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM stock_balances sb
       INNER JOIN produtos p ON sb.product_id = p.id
       ${whereSql}`,
      params
    );

    return { data: rows, total: countRow?.total ?? 0 };
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
        "SELECT qty_on_hand, qty_reserved FROM stock_balances WHERE product_id = ? AND empresa_id = ?",
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
          `INSERT INTO stock_balances (product_id, empresa_id, qty_on_hand, qty_reserved)
           VALUES (?, ?, ?, 0)
           ON DUPLICATE KEY UPDATE qty_on_hand = qty_on_hand + ?`,
          [product_id, empId, qty, qty]
        );
      } else if (type === "EXIT") {
        qtyAfter = qtyBefore - qty;
        await connection.query(
          `UPDATE stock_balances 
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
   * Verifica disponibilidade de produto por empresa
   */
  static async checkAvailability(productId, qty, empresaId = 1) {
    const empId = Number(empresaId) || 1;
    const [rows] = await db.query(
      `SELECT qty_on_hand, qty_reserved,
              COALESCE(qty_available, qty_on_hand - qty_reserved) AS qty_available
       FROM stock_balances
       WHERE product_id = ? AND empresa_id = ?`,
      [productId, empId]
    );

    const balance = rows[0] || { qty_on_hand: 0, qty_reserved: 0, qty_available: 0 };
    return {
      available: Number(balance.qty_available) >= Number(qty),
      qtyAvailable: Number(balance.qty_available),
      qtyOnHand: balance.qty_on_hand,
      qtyReserved: balance.qty_reserved,
    };
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
          "SELECT qty_on_hand FROM stock_balances WHERE product_id = ? AND empresa_id = ?",
          [productId, empresa_id]
        );
        const qtyBefore = balRows[0]?.qty_on_hand ?? 0;
        const qtyAfter = qtyBefore + qty;

        await connection.query(
          `INSERT INTO stock_balances (product_id, empresa_id, qty_on_hand, qty_reserved)
           VALUES (?, ?, ?, 0)
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
