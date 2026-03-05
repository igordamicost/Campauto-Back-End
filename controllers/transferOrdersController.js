import { TransferOrderRepository } from "../src/repositories/transferOrder.repository.js";
import { z } from "zod";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const createSchema = z.object({
  orcamento_id: z.number().int().positive().nullable().optional(),
  empresa_origem_id: z.number().int().positive(),
  empresa_destino_id: z.number().int().positive(),
  items: z.array(
    z.object({
      product_id: z.number().int().positive(),
      quantity: z.number().positive(),
    })
  ),
});

const statusSchema = z.object({
  status: z.enum(["draft", "requested", "nf_issued", "in_transit", "received", "canceled"]),
});

async function list(req, res) {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      q: req.query.q,
      status: req.query.status,
      orcamento_id: req.query.orcamento_id,
      empresa_origem_id: req.query.empresa_origem_id,
      empresa_destino_id: req.query.empresa_destino_id,
    };
    const result = await TransferOrderRepository.list(filters);
    return res.json(result);
  } catch (error) {
    console.error("Error listing transfer orders:", error);
    return res.status(500).json({ message: "Erro ao listar pedidos de movimentação" });
  }
}

async function getById(req, res) {
  try {
    const order = await TransferOrderRepository.getById(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "Pedido de movimentação não encontrado" });
    return res.json(order);
  } catch (error) {
    console.error("Error getting transfer order:", error);
    return res.status(500).json({ message: "Erro ao buscar pedido" });
  }
}

async function create(req, res) {
  try {
    const validation = createSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        errors: validation.error.errors,
      });
    }
    const id = await TransferOrderRepository.create(validation.data);
    const order = await TransferOrderRepository.getById(id);
    return res.status(201).json(order);
  } catch (error) {
    console.error("Error creating transfer order:", error);
    return res.status(500).json({ message: "Erro ao criar pedido de movimentação" });
  }
}

async function updateStatus(req, res) {
  try {
    const validation = statusSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "status inválido",
        errors: validation.error.errors,
      });
    }
    const ok = await TransferOrderRepository.updateStatus(
      Number(req.params.id),
      validation.data.status
    );
    if (!ok) return res.status(404).json({ message: "Pedido não encontrado" });
    const order = await TransferOrderRepository.getById(Number(req.params.id));
    return res.json(order);
  } catch (error) {
    console.error("Error updating transfer order status:", error);
    return res.status(500).json({ message: "Erro ao atualizar status" });
  }
}

export default {
  list: asyncHandler(list),
  getById: asyncHandler(getById),
  create: asyncHandler(create),
  updateStatus: asyncHandler(updateStatus),
};
