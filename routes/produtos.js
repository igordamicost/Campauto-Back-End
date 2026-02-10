import express from "express";
import * as controller from "../controllers/produtosController.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * @openapi
 * /produtos:
 *   get:
 *     summary: Lista produtos
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
 *         description: Lista de produtos
 */
router.get('/', asyncHandler(controller.list));

/**
 * @openapi
 * /produtos/{id}:
 *   get:
 *     summary: Busca produto por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Produto encontrado
 *       404:
 *         description: Produto não encontrado
 */
router.get('/:id', asyncHandler(controller.getById));

/**
 * @openapi
 * /produtos:
 *   post:
 *     summary: Cria produto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Produto criado
 */
router.post('/', asyncHandler(controller.create));

/**
 * @openapi
 * /produtos/{id}:
 *   put:
 *     summary: Atualiza produto
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
 *         description: Produto atualizado
 *       404:
 *         description: Produto não encontrado
 */
router.put('/:id', asyncHandler(controller.update));

/**
 * @openapi
 * /produtos/{id}:
 *   delete:
 *     summary: Remove produto
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Produto removido
 *       404:
 *         description: Produto não encontrado
 */
router.delete('/:id', asyncHandler(controller.remove));

export default router;
