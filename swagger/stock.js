/**
 * @openapi
 * /stock/balances:
 *   get:
 *     summary: Lista saldos de estoque (requer stock.read)
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema:
 *           type: integer
 *         description: Filtrar por produto
 *       - in: query
 *         name: locationId
 *         schema:
 *           type: integer
 *         description: Filtrar por localização
 *     responses:
 *       200:
 *         description: Lista de saldos
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
 *                       product_id:
 *                         type: integer
 *                       product_name:
 *                         type: string
 *                       product_code:
 *                         type: string
 *                       location_id:
 *                         type: integer
 *                       qty_on_hand:
 *                         type: number
 *                         description: Quantidade total em estoque
 *                       qty_reserved:
 *                         type: number
 *                         description: Quantidade reservada
 *                       qty_available:
 *                         type: number
 *                         description: Quantidade disponível (qty_on_hand - qty_reserved)
 *       403:
 *         description: Sem permissão stock.read
 */

/**
 * @openapi
 * /stock/movements:
 *   get:
 *     summary: Lista movimentações de estoque (requer stock.read)
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: locationId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [ENTRY, EXIT, ADJUSTMENT, RESERVE, RESERVE_RETURN, RESERVE_CONVERT]
 *       - in: query
 *         name: refType
 *         schema:
 *           type: string
 *         description: Tipo de referência exemplo PURCHASE ou SALE
 *       - in: query
 *         name: refId
 *         schema:
 *           type: integer
 *         description: ID da referência
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Lista de movimentações
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *       403:
 *         description: Sem permissão stock.read
 */

/**
 * @openapi
 * /stock/movements:
 *   post:
 *     summary: Cria movimentação de estoque (requer stock.move)
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_id, type, qty]
 *             properties:
 *               product_id:
 *                 type: integer
 *               location_id:
 *                 type: integer
 *                 default: 1
 *               type:
 *                 type: string
 *                 enum: [ENTRY, EXIT, ADJUSTMENT]
 *                 description: ENTRY aumenta estoque, EXIT diminui, ADJUSTMENT ajusta
 *               qty:
 *                 type: number
 *                 minimum: 0.001
 *               ref_type:
 *                 type: string
 *                 description: Tipo de referência exemplo PURCHASE ou SALE
 *               ref_id:
 *                 type: integer
 *                 description: ID da referência
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Movimentação criada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 product_id:
 *                   type: integer
 *                 product_name:
 *                   type: string
 *                 type:
 *                   type: string
 *                 qty:
 *                   type: number
 *                 qty_before:
 *                   type: number
 *                 qty_after:
 *                   type: number
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Dados inválidos ou quantidade insuficiente (para EXIT)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 available:
 *                   type: number
 *                 requested:
 *                   type: number
 *       403:
 *         description: Sem permissão stock.move
 */

/**
 * @openapi
 * /stock/availability/{productId}:
 *   get:
 *     summary: Verifica disponibilidade de produto (requer stock.read)
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: qty
 *         schema:
 *           type: number
 *           default: 1
 *         description: Quantidade desejada
 *       - in: query
 *         name: locationId
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Localização
 *     responses:
 *       200:
 *         description: Disponibilidade do produto
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                   description: true se quantidade disponível >= qty solicitada
 *                 qtyAvailable:
 *                   type: number
 *                   description: Quantidade disponível (qty_on_hand - qty_reserved)
 *                 qtyOnHand:
 *                   type: number
 *                   description: Quantidade total em estoque
 *                 qtyReserved:
 *                   type: number
 *                   description: Quantidade reservada
 *                 requested:
 *                   type: number
 *                   description: Quantidade solicitada (apenas quando available=false)
 *       404:
 *         description: Produto não encontrado
 *       403:
 *         description: Sem permissão
 */
