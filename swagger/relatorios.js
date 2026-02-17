/**
 * @openapi
 * /relatorios/orcamentos:
 *   get:
 *     summary: Relatório de orçamentos com KPIs e agregações (comparativo mensal, evolução diária)
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
 *                 agregacoes:
 *                   type: object
 *                   properties:
 *                     comparativo_mensal:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           mes:
 *                             type: integer
 *                             description: 0-11 (Janeiro=0)
 *                           mes_nome:
 *                             type: string
 *                           ano:
 *                             type: integer
 *                           total:
 *                             type: number
 *                           quantidade:
 *                             type: integer
 *                     evolucao_diaria:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           dia:
 *                             type: integer
 *                           mes:
 *                             type: integer
 *                           ano:
 *                             type: integer
 *                           data:
 *                             type: string
 *                             format: date
 *                           total:
 *                             type: number
 *                           quantidade:
 *                             type: integer
 *                     kpis:
 *                       type: object
 *                       properties:
 *                         total_mes_atual:
 *                           type: number
 *                         total_ano_atual:
 *                           type: number
 *                         ticket_medio_mes_atual:
 *                           type: number
 *                         quantidade_mes_atual:
 *                           type: integer
 *                         mes_atual:
 *                           type: integer
 *                         ano_atual:
 *                           type: integer
 *       400:
 *         description: Formato de data inválido
 *       401:
 *         description: Token inválido ou expirado
 *       500:
 *         description: Erro ao processar relatório
 */
