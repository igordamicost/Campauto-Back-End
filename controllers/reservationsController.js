import { ReservationRepository } from "../src/repositories/reservation.repository.js";
import { StockRepository } from "../src/repositories/stock.repository.js";
import { z } from "zod";

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const createReservationSchema = z.object({
  product_id: z.number().int().positive(),
  customer_id: z.number().int().positive().nullable().optional(),
  qty: z.number().positive(),
  due_at: z.string().datetime(),
  notes: z.string().optional(),
  location_id: z.number().int().positive().optional(),
});

const updateReservationSchema = z.object({
  due_at: z.string().datetime().optional(),
  notes: z.string().optional(),
});

/**
 * Lista reservas
 */
async function listReservations(req, res) {
  try {
    const {
      status,
      dueFrom,
      dueTo,
      customerId,
      productId,
      salespersonId,
      limit = 50,
      offset = 0,
    } = req.query;

    const filters = {
      status: status || undefined,
      dueFrom: dueFrom || undefined,
      dueTo: dueTo || undefined,
      customerId: customerId ? Number(customerId) : undefined,
      productId: productId ? Number(productId) : undefined,
      salespersonId: salespersonId ? Number(salespersonId) : undefined,
      limit: Number(limit),
      offset: Number(offset),
    };

    const result = await ReservationRepository.list(filters);

    return res.json(result);
  } catch (error) {
    console.error("Error listing reservations:", error);
    return res.status(500).json({ message: "Erro ao listar reservas" });
  }
}

/**
 * Busca reserva por ID
 */
async function getReservationById(req, res) {
  try {
    const { id } = req.params;
    const reservation = await ReservationRepository.getById(id);

    if (!reservation) {
      return res.status(404).json({ message: "Reserva não encontrada" });
    }

    return res.json(reservation);
  } catch (error) {
    console.error("Error getting reservation:", error);
    return res.status(500).json({ message: "Erro ao buscar reserva" });
  }
}

/**
 * Cria reserva
 */
async function createReservation(req, res) {
  try {
    const validation = createReservationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        errors: validation.error.errors,
      });
    }

    const data = validation.data;

    // Verificar disponibilidade
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

    // Criar reserva
    const reservationId = await ReservationRepository.create({
      ...data,
      salesperson_user_id: req.user.userId,
      created_by: req.user.userId,
      location_id: data.location_id || 1,
    });

    const reservation = await ReservationRepository.getById(reservationId);

    return res.status(201).json(reservation);
  } catch (error) {
    console.error("Error creating reservation:", error);
    return res.status(500).json({ message: "Erro ao criar reserva" });
  }
}

/**
 * Atualiza reserva
 */
async function updateReservation(req, res) {
  try {
    const { id } = req.params;
    const validation = updateReservationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        errors: validation.error.errors,
      });
    }

    const updated = await ReservationRepository.update(id, validation.data);

    if (!updated) {
      return res.status(404).json({ message: "Reserva não encontrada" });
    }

    const reservation = await ReservationRepository.getById(id);

    return res.json(reservation);
  } catch (error) {
    console.error("Error updating reservation:", error);
    return res.status(500).json({ message: "Erro ao atualizar reserva" });
  }
}

/**
 * Retorna reserva (devolução)
 */
async function returnReservation(req, res) {
  try {
    const { id } = req.params;

    await ReservationRepository.returnReservation(id, req.user.userId);

    const reservation = await ReservationRepository.getById(id);

    return res.json({
      message: "Reserva devolvida com sucesso",
      reservation,
    });
  } catch (error) {
    console.error("Error returning reservation:", error);
    if (error.message === "Reserva não encontrada ou já finalizada") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Erro ao devolver reserva" });
  }
}

/**
 * Cancela reserva
 */
async function cancelReservation(req, res) {
  try {
    const { id } = req.params;

    await ReservationRepository.cancelReservation(id, req.user.userId);

    const reservation = await ReservationRepository.getById(id);

    return res.json({
      message: "Reserva cancelada com sucesso",
      reservation,
    });
  } catch (error) {
    console.error("Error canceling reservation:", error);
    if (error.message === "Reserva não encontrada ou já finalizada") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Erro ao cancelar reserva" });
  }
}

export default {
  listReservations: asyncHandler(listReservations),
  getReservationById: asyncHandler(getReservationById),
  createReservation: asyncHandler(createReservation),
  updateReservation: asyncHandler(updateReservation),
  returnReservation: asyncHandler(returnReservation),
  cancelReservation: asyncHandler(cancelReservation),
};
