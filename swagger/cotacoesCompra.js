/**
 * @openapi
 * /cotacoes-compra/ultima:
 *   get:
 *     summary: Última cotação de compra por código de produto
 *     tags: [Cotações de Compra]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: codigo_produto
 *         required: true
 *         schema:
 *           type: string
 *         description: Código do produto
 *     responses:
 *       200:
 *         description: Última cotação (valor_custo, local, data)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: integer }
 *                 codigo_produto: { type: string }
 *                 valor_custo: { type: number }
 *                 local: { type: string }
 *                 data: { type: string, format: date }
 *       404:
 *         description: Nenhuma cotação encontrada para o código
 */

/**
 * @openapi
 * /cotacoes-compra/ultimas:
 *   post:
 *     summary: Últimas cotações em lote (por lista de códigos)
 *     tags: [Cotações de Compra]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [codigos]
 *             properties:
 *               codigos:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Array com última cotação de cada código
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   codigo_produto: { type: string }
 *                   valor_custo: { type: number }
 *                   local: { type: string }
 *                   data: { type: string, format: date }
 */

/**
 * @openapi
 * /cotacoes-compra:
 *   post:
 *     summary: Registrar nova cotação de compra
 *     tags: [Cotações de Compra]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [codigo_produto, valor_custo, local]
 *             properties:
 *               codigo_produto: { type: string }
 *               valor_custo: { type: number }
 *               local: { type: string }
 *               data: { type: string, format: date, description: Opcional; se omitido usa data atual }
 *     responses:
 *       201:
 *         description: Cotação criada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: integer }
 *                 codigo_produto: { type: string }
 *                 valor_custo: { type: number }
 *                 local: { type: string }
 *                 data: { type: string, format: date }
 */
