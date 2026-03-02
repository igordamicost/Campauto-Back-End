/**
 * @openapi
 * /metrics:
 *   get:
 *     summary: Métricas Prometheus
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: Métricas no formato Prometheus
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
