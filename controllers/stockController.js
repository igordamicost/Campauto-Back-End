import { StockRepository } from "../src/repositories/stock.repository.js";
import { db } from "../src/config/database.js";
import { z } from "zod";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const createMovementSchema = z.object({
  product_id: z.number().int().positive(),
  location_id: z.number().int().positive().optional(),
  type: z.enum(["ENTRY", "EXIT", "ADJUSTMENT"]),
  qty: z.number().positive(),
  ref_type: z.string().optional(),
  ref_id: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

/**
 * Lista saldos de estoque
 */
async function listBalances(req, res) {
  try {
    const { productId, locationId } = req.query;

    const filters = {
      productId: productId ? Number(productId) : undefined,
      locationId: locationId ? Number(locationId) : undefined,
    };

    const balances = await StockRepository.getBalances(filters);

    return res.json({ data: balances });
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
      locationId,
      type,
      refType,
      refId,
      limit = 100,
      offset = 0,
    } = req.query;

    const filters = {
      productId: productId ? Number(productId) : undefined,
      locationId: locationId ? Number(locationId) : undefined,
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
 * Cria movimentação de estoque
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

    // Para saída, verificar disponibilidade
    if (data.type === "EXIT") {
      const availability = await StockRepository.checkAvailability(
        data.product_id,
        data.qty,
        data.location_id || 1
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
      created_by: req.user.userId,
      location_id: data.location_id || 1,
    });

    // Buscar movimentação criada pelo ID
    const [movementRows] = await db.query(
      `SELECT sm.id, sm.product_id, sm.location_id, sm.type, sm.qty, sm.qty_before, sm.qty_after,
              sm.ref_type, sm.ref_id, sm.notes, sm.created_by, sm.created_at,
              p.descricao AS product_name, p.codigo AS product_code,
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
 * Verifica disponibilidade de produto
 */
async function checkAvailability(req, res) {
  try {
    const { productId } = req.params;
    const { qty = 1, locationId = 1 } = req.query;

    const requestedQty = Number(qty);
    const availability = await StockRepository.checkAvailability(
      Number(productId),
      requestedQty,
      Number(locationId)
    );

    // Adicionar campo requested se não disponível
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
  checkAvailability: asyncHandler(checkAvailability),
};
