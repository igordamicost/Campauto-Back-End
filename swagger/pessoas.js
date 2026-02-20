/**
 * @openapi
 * /pessoas/funcionarios:
 *   get:
 *     summary: Lista funcionários
 *     tags: [Pessoas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Busca geral
 *     responses:
 *       200:
 *         description: Lista de funcionários paginada
 */
