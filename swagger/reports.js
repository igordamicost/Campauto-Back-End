/**
 * @openapi
 * /reports/my-sales:
 *   get:
 *     summary: Relatório de vendas do usuário logado (requer reports.my_sales.read)
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *         description: Mês no formato YYYY-MM exemplo 2026-02
 *     responses:
 *       200:
 *         description: Relatório de vendas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 month:
 *                   type: string
 *                   example: "2026-02"
 *                 total_sales:
 *                   type: integer
 *                   description: Total de vendas
 *                 total_amount:
 *                   type: number
 *                   description: Valor total vendido
 *                 average_ticket:
 *                   type: number
 *                   description: Ticket médio
 *                 daily_breakdown:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       count:
 *                         type: integer
 *                       amount:
 *                         type: number
 *       400:
 *         description: Mês inválido ou não informado
 *       403:
 *         description: Sem permissão reports.my_sales.read
 */
