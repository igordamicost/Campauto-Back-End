import express from "express";
import * as controller from "../controllers/clientesController.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * @openapi
 * /clientes:
 *   get:
 *     summary: Lista clientes
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Página (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Itens por página (default 10)
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *         description: Alias de limit
 *     responses:
 *       200:
 *         description: Lista de clientes
 */
router.get('/', asyncHandler(controller.list));

/**
 * @openapi
 * /clientes/{id}:
 *   get:
 *     summary: Busca cliente por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Cliente encontrado
 *       404:
 *         description: Cliente não encontrado
 */
router.get('/:id', asyncHandler(controller.getById));

/**
 * @openapi
 * /clientes:
 *   post:
 *     summary: Cria cliente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Cliente criado
 */
router.post('/', asyncHandler(controller.create));

/**
 * @openapi
 * /clientes/{id}:
 *   put:
 *     summary: Atualiza cliente
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Cliente atualizado
 *       404:
 *         description: Cliente não encontrado
 */
router.put('/:id', asyncHandler(controller.update));

/**
 * @openapi
 * /clientes/{id}:
 *   delete:
 *     summary: Remove cliente
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Cliente removido
 *       404:
 *         description: Cliente não encontrado
 */
router.delete('/:id', asyncHandler(controller.remove));

export default router;
