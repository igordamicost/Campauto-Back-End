/**
 * @openapi
 * /reports/my-sales/metrics:
 *   get:
 *     summary: Métricas do mês (Meu Desempenho)
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema: { type: string, pattern: '^\d{4}-\d{2}$' }
 *         description: Mês no formato YYYY-MM
 *     responses:
 *       200:
 *         description: Métricas do mês
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orcamentos: { type: integer }
 *                 vendas_reais: { type: number }
 *                 quantidade_vendas: { type: integer }
 *                 orcamentos_nao_fechados: { type: integer }
 *       400:
 *         description: Mês inválido
 *       403:
 *         description: Sem permissão reports.my_sales.read
 */

/**
 * @openapi
 * /reports/my-sales:
 *   get:
 *     summary: Lista de vendas do mês (orçamentos faturados)
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema: { type: string, pattern: '^\d{4}-\d{2}$' }
 *         description: Mês no formato YYYY-MM
 *     responses:
 *       200:
 *         description: Lista de vendas + resumo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vendas:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       data: { type: string, format: date }
 *                       cliente_nome: { type: string }
 *                       valor: { type: number }
 *                       status: { type: string }
 *                 resumo:
 *                   type: object
 *                   properties:
 *                     total: { type: number }
 *                     quantidade: { type: integer }
 *       400:
 *         description: Mês inválido
 *       403:
 *         description: Sem permissão reports.my_sales.read
 */

/**
 * @openapi
 * /reports/my-sales/evolucao:
 *   get:
 *     summary: Evolução mensal (gráfico de linha)
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema: { type: integer, default: 12 }
 *         description: Quantidade de meses (1-24)
 *     responses:
 *       200:
 *         description: Evolução mensal
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 evolucao:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       month: { type: string }
 *                       valor: { type: number }
 *                       quantidade: { type: integer }
 *       403:
 *         description: Sem permissão reports.my_sales.read
 */
