/**
 * @openapi
 * /relatorios/orcamentos:
 *   get:
 *     summary: Relatório de orçamentos para KPIs e gráficos financeiros
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: data_inicio
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *         description: Data inicial (YYYY-MM-DD)
 *       - in: query
 *         name: data_fim
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-12-31"
 *         description: Data final (YYYY-MM-DD)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Cotação, Aprovado, Separado, Faturado, Cancelado]
 *         description: Filtrar por status
 *     responses:
 *       200:
 *         description: Lista de orçamentos com itens e clientes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       numero_sequencial:
 *                         type: integer
 *                       data:
 *                         type: string
 *                         format: date
 *                       status:
 *                         type: string
 *                       json_itens:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             produto_id:
 *                               type: integer
 *                             quantidade:
 *                               type: number
 *                             valor_unitario:
 *                               type: number
 *                             total:
 *                               type: number
 *                       clientes:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: integer
 *                           nome:
 *                             type: string
 *                           fantasia:
 *                             type: string
 *                           empresa:
 *                             type: string
 *                             nullable: true
 *       400:
 *         description: Formato de data inválido
 *       401:
 *         description: Token inválido ou expirado
 *       500:
 *         description: Erro ao processar relatório
 */
