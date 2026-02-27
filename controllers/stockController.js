import { StockRepository } from "../src/repositories/stock.repository.js";
import { db } from "../src/config/database.js";
import { z } from "zod";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const createMovementSchema = z.object({
  product_id: z.number().int().positive(),
  empresa_id: z.number().int().positive().optional(),
  location_id: z.number().int().positive().optional(), // legado: mapeia para empresa_id
  type: z.enum(["ENTRY", "EXIT", "ADJUSTMENT"]),
  qty: z.number().positive(),
  ref_type: z.string().optional(),
  ref_id: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

const createEntrySchema = z.object({
  product_id: z.number().int().positive(),
  empresa_id: z.number().int().positive(),
  quantity: z.number().positive(),
  tipo: z.string().optional(),
  observacao: z.string().optional(),
});

/**
 * Lista saldos de estoque (por produto e por empresa/loja)
 * Query: productId, empresa_id, q (busca por código/descrição/código fábrica), page, limit
 */
async function listBalances(req, res) {
  try {
    const { productId, empresa_id, locationId, q, page = 1, limit = 2000 } = req.query;
    const limitNum = Math.min(Number(limit) || 2000, 2000);
    const pageNum = Math.max(1, Number(page) || 1);
    const offset = (pageNum - 1) * limitNum;

    const filters = {
      productId: productId ? Number(productId) : undefined,
      empresa_id: empresa_id != null ? Number(empresa_id) : (locationId != null ? Number(locationId) : undefined),
      q: q ? String(q).trim() || undefined : undefined,
      limit: limitNum,
      offset,
    };

    const { data, total } = await StockRepository.getBalances(filters);
    return res.json({ data, total });
  } catch (error) {
    console.error("Error listing stock balances:", error);
    return res.status(500).json({ message: "Erro ao listar saldos de estoque" });
  }
}

/**
 * Lista movimentações de estoque
 */
async function listMovements(req, res) {
  try {
    const {
      productId,
      empresa_id,
      locationId,
      type,
      refType,
      refId,
      limit = 100,
      offset = 0,
    } = req.query;

    const filters = {
      productId: productId ? Number(productId) : undefined,
      empresa_id: empresa_id != null ? Number(empresa_id) : (locationId != null ? Number(locationId) : undefined),
      type: type || undefined,
      refType: refType || undefined,
      refId: refId ? Number(refId) : undefined,
      limit: Number(limit),
      offset: Number(offset),
    };

    const result = await StockRepository.getMovements(filters);
    return res.json(result);
  } catch (error) {
    console.error("Error listing stock movements:", error);
    return res.status(500).json({ message: "Erro ao listar movimentações" });
  }
}

/**
 * Cria movimentação de estoque (usa empresa_id)
 */
async function createMovement(req, res) {
  try {
    const validation = createMovementSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        errors: validation.error.errors,
      });
    }

    const data = validation.data;
    const empresa_id = data.empresa_id ?? data.location_id ?? 1;

    if (data.type === "EXIT") {
      const availability = await StockRepository.checkAvailability(
        data.product_id,
        data.qty,
        empresa_id
      );

      if (!availability.available) {
        return res.status(400).json({
          message: "Quantidade insuficiente em estoque",
          available: availability.qtyAvailable,
          requested: data.qty,
        });
      }
    }

    const movementId = await StockRepository.createMovement({
      ...data,
      empresa_id,
      created_by: req.user?.userId,
    });

    const [movementRows] = await db.query(
      `SELECT sm.id, sm.product_id, sm.empresa_id, sm.type, sm.qty, sm.qty_before, sm.qty_after,
              sm.ref_type, sm.ref_id, sm.notes, sm.created_by, sm.created_at,
              p.descricao AS product_name, p.codigo_produto AS product_code,
              u.name AS created_by_name
       FROM stock_movements sm
       LEFT JOIN produtos p ON sm.product_id = p.id
       LEFT JOIN users u ON sm.created_by = u.id
       WHERE sm.id = ?`,
      [movementId]
    );

    return res.status(201).json(movementRows[0]);
  } catch (error) {
    console.error("Error creating movement:", error);
    return res.status(500).json({ message: "Erro ao criar movimentação" });
  }
}

/**
 * POST /stock/entries - Entrada manual ou por código de barras
 * Body: { product_id, empresa_id, quantity, tipo?, observacao? }
 */
async function createEntry(req, res) {
  try {
    const validation = createEntrySchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        errors: validation.error.errors,
      });
    }

    const { product_id, empresa_id, quantity, tipo, observacao } = validation.data;

    const movementId = await StockRepository.createMovement({
      product_id,
      empresa_id,
      type: "ENTRY",
      qty: quantity,
      ref_type: tipo || "entrada_manual",
      notes: observacao || null,
      created_by: req.user?.userId,
    });

    const [rows] = await db.query(
      `SELECT sm.id, sm.product_id, sm.empresa_id, sm.type, sm.qty, sm.qty_before, sm.qty_after,
              sm.ref_type, sm.notes, sm.created_at,
              p.descricao AS product_name, p.codigo_produto AS product_code
       FROM stock_movements sm
       LEFT JOIN produtos p ON sm.product_id = p.id
       WHERE sm.id = ?`,
      [movementId]
    );

    return res.status(201).json(rows[0] || { id: movementId, product_id, empresa_id, quantity, type: "ENTRY" });
  } catch (error) {
    console.error("Error creating stock entry:", error);
    return res.status(500).json({ message: "Erro ao registrar entrada de estoque" });
  }
}

/**
 * GET /stock/products/by-barcode?barcode=xxx - Produto por código de barras
 */
async function getByBarcode(req, res) {
  try {
    const { barcode } = req.query;
    const product = await StockRepository.getProductByBarcode(barcode);
    if (!product) {
      return res.status(404).json({ message: "Produto não encontrado para este código de barras" });
    }
    return res.json({ ...product, product_id: product.id });
  } catch (error) {
    console.error("Error getting product by barcode:", error);
    return res.status(500).json({ message: "Erro ao buscar produto" });
  }
}

/**
 * POST /stock/import-xml - Importar XML (pedido fábrica) e dar entrada por empresa_id
 * Body: { empresa_id, xml } (string XML no campo xml)
 */
async function importXml(req, res) {
  try {
    const empresa_id = req.body?.empresa_id != null ? Number(req.body.empresa_id) : null;
    const xmlContent = req.body?.xml;

    if (empresa_id == null || !empresa_id) {
      return res.status(400).json({ message: "empresa_id é obrigatório" });
    }
    if (!xmlContent || typeof xmlContent !== "string") {
      return res.status(400).json({ message: "Conteúdo XML é obrigatório (campo xml)" });
    }

    const result = await StockRepository.importXmlEntries(empresa_id, xmlContent, req.user?.userId);

    return res.status(201).json(result);
  } catch (error) {
    console.error("Error importing XML:", error);
    return res.status(500).json({
      message: error.message || "Erro ao importar XML",
    });
  }
}

/**
 * Verifica disponibilidade de produto por empresa
 */
async function checkAvailability(req, res) {
  try {
    const { productId } = req.params;
    const { qty = 1, empresa_id, locationId } = req.query;
    const empId = empresa_id != null ? Number(empresa_id) : (locationId != null ? Number(locationId) : 1);
    const requestedQty = Number(qty);
    const availability = await StockRepository.checkAvailability(
      Number(productId),
      requestedQty,
      empId
    );

    if (!availability.available) {
      availability.requested = requestedQty;
    }

    return res.json(availability);
  } catch (error) {
    console.error("Error checking availability:", error);
    return res.status(500).json({ message: "Erro ao verificar disponibilidade" });
  }
}

export default {
  listBalances: asyncHandler(listBalances),
  listMovements: asyncHandler(listMovements),
  createMovement: asyncHandler(createMovement),
  createEntry: asyncHandler(createEntry),
  getByBarcode: asyncHandler(getByBarcode),
  importXml: asyncHandler(importXml),
  checkAvailability: asyncHandler(checkAvailability),
};
