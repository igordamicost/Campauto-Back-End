import { PreOrderRepository } from "../src/repositories/preOrder.repository.js";
import { z } from "zod";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const createSchema = z.object({
  orcamento_id: z.number().int().positive().nullable().optional(),
  items: z.array(
    z.object({
      product_id: z.number().int().positive(),
      quantity: z.number().positive(),
    })
  ),
});

const statusSchema = z.object({
  status: z.enum([
    "created",
    "pending_manager_review",
    "approved_for_quote",
    "quoted",
    "supplier_selected",
    "purchased",
    "received",
    "canceled",
  ]),
});

async function list(req, res) {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      q: req.query.q,
      status: req.query.status,
      orcamento_id: req.query.orcamento_id,
    };
    const result = await PreOrderRepository.list(filters);
    return res.json(result);
  } catch (error) {
    console.error("Error listing pre-orders:", error);
    return res.status(500).json({ message: "Erro ao listar pré-pedidos" });
  }
}

async function getById(req, res) {
  try {
    const order = await PreOrderRepository.getById(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "Pré-pedido não encontrado" });
    return res.json(order);
  } catch (error) {
    console.error("Error getting pre-order:", error);
    return res.status(500).json({ message: "Erro ao buscar pré-pedido" });
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
    const id = await PreOrderRepository.create(validation.data);
    const order = await PreOrderRepository.getById(id);
    return res.status(201).json(order);
  } catch (error) {
    console.error("Error creating pre-order:", error);
    return res.status(500).json({ message: "Erro ao criar pré-pedido" });
  }
}

async function approve(req, res) {
  try {
    const ok = await PreOrderRepository.approve(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Pré-pedido não encontrado" });
    const order = await PreOrderRepository.getById(Number(req.params.id));
    return res.json(order);
  } catch (error) {
    console.error("Error approving pre-order:", error);
    return res.status(500).json({ message: "Erro ao aprovar pré-pedido" });
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
    const ok = await PreOrderRepository.updateStatus(
      Number(req.params.id),
      validation.data.status
    );
    if (!ok) return res.status(404).json({ message: "Pré-pedido não encontrado" });
    const order = await PreOrderRepository.getById(Number(req.params.id));
    return res.json(order);
  } catch (error) {
    console.error("Error updating pre-order status:", error);
    return res.status(500).json({ message: "Erro ao atualizar status" });
  }
}

export default {
  list: asyncHandler(list),
  getById: asyncHandler(getById),
  create: asyncHandler(create),
  approve: asyncHandler(approve),
  updateStatus: asyncHandler(updateStatus),
};
