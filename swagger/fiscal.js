/**
 * @openapi
 * /fiscal/exportacoes:
 *   get:
 *     summary: Lista exportações fiscais
 *     tags: [Fiscal]
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
 *     responses:
 *       200:
 *         description: Lista de exportações fiscais
 */
