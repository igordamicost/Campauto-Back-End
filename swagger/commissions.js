/**
 * @openapi
 * /commissions:
 *   get:
 *     summary: Comissões do usuário logado (requer commissions.read)
 *     tags: [Comissões]
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
 *         description: Comissões do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 month:
 *                   type: string
 *                   example: "2026-02"
 *                 commissions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       sale_id:
 *                         type: integer
 *                       base_amount:
 *                         type: number
 *                       commission_rate:
 *                         type: number
 *                         description: Percentual de comissão
 *                       commission_amount:
 *                         type: number
 *                       status:
 *                         type: string
 *                         enum: [PENDING, PAID, CANCELED]
 *                       paid_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       sale_date:
 *                         type: string
 *                         format: date-time
 *                       sale_total:
 *                         type: number
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total_commission:
 *                       type: number
 *                     paid_commission:
 *                       type: number
 *                     pending_commission:
 *                       type: number
 *       400:
 *         description: Mês inválido ou não informado
 *       403:
 *         description: Sem permissão commissions.read
 */

/**
 * @openapi
 * /commissions/by-salesperson:
 *   get:
 *     summary: Comissões por vendedor (admin, requer commissions.read)
 *     tags: [Comissões]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *         description: Mês no formato YYYY-MM
 *       - in: query
 *         name: salespersonId
 *         schema:
 *           type: integer
 *         description: Filtrar por vendedor (opcional, se não informado retorna todos)
 *     responses:
 *       200:
 *         description: Comissões por vendedor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 month:
 *                   type: string
 *                   example: "2026-02"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       salesperson_user_id:
 *                         type: integer
 *                       salesperson_name:
 *                         type: string
 *                       salesperson_email:
 *                         type: string
 *                       total_commissions:
 *                         type: integer
 *                         description: Quantidade de comissões
 *                       total_amount:
 *                         type: number
 *                         description: Valor total
 *                       paid_amount:
 *                         type: number
 *                       pending_amount:
 *                         type: number
 *       400:
 *         description: Mês inválido ou não informado
 *       403:
 *         description: Sem permissão commissions.read
 */

/**
 * @openapi
 * /commissions/calculate/{saleId}:
 *   post:
 *     summary: Calcula e cria comissão para uma venda (requer commissions.read)
 *     tags: [Comissões]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: saleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da venda
 *     responses:
 *       200:
 *         description: Comissão calculada e criada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 commission:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     sale_id:
 *                       type: integer
 *                     salesperson_user_id:
 *                       type: integer
 *                     base_amount:
 *                       type: number
 *                     commission_rate:
 *                       type: number
 *                     commission_amount:
 *                       type: number
 *                     status:
 *                       type: string
 *                       enum: [PENDING, PAID, CANCELED]
 *                 message:
 *                   type: string
 *       404:
 *         description: Venda não encontrada
 *       400:
 *         description: Venda já possui comissão calculada
 *       403:
 *         description: Sem permissão commissions.read
 */
