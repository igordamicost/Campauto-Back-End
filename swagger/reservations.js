/**
 * @openapi
 * /reservations:
 *   get:
 *     summary: Lista reservas (requer stock.read)
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, DUE_SOON, OVERDUE, RETURNED, CANCELED, CONVERTED]
 *         description: Filtrar por status
 *       - in: query
 *         name: dueFrom
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Data inicial (ISO datetime)
 *       - in: query
 *         name: dueTo
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Data final (ISO datetime)
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: integer
 *         description: Filtrar por cliente
 *       - in: query
 *         name: productId
 *         schema:
 *           type: integer
 *         description: Filtrar por produto
 *       - in: query
 *         name: salespersonId
 *         schema:
 *           type: integer
 *         description: Filtrar por vendedor
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Lista de reservas
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
 * /reservations/{id}:
 *   get:
 *     summary: Busca reserva por ID (requer stock.read)
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reserva encontrada
 *       404:
 *         description: Reserva não encontrada
 *       403:
 *         description: Sem permissão
 */

/**
 * @openapi
 * /reservations:
 *   post:
 *     summary: Cria reserva (requer stock.reserve.create)
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_id, qty, due_at]
 *             properties:
 *               product_id:
 *                 type: integer
 *               customer_id:
 *                 type: integer
 *               qty:
 *                 type: number
 *                 minimum: 0.001
 *               due_at:
 *                 type: string
 *                 format: date-time
 *                 description: Data/hora limite para devolução (ISO datetime)
 *               notes:
 *                 type: string
 *               location_id:
 *                 type: integer
 *                 default: 1
 *     responses:
 *       201:
 *         description: Reserva criada
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
 *                 qty:
 *                   type: number
 *                 status:
 *                   type: string
 *                   enum: [ACTIVE]
 *                 due_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Dados inválidos ou quantidade insuficiente
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
 *         description: Sem permissão stock.reserve.create
 */

/**
 * @openapi
 * /reservations/{id}:
 *   put:
 *     summary: Atualiza reserva (requer stock.reserve.update)
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               due_at:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reserva atualizada
 *       404:
 *         description: Reserva não encontrada
 *       403:
 *         description: Sem permissão
 */

/**
 * @openapi
 * /reservations/{id}/return:
 *   post:
 *     summary: Devolve reserva (requer stock.reserve.update)
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reserva devolvida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 reservation:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       enum: [RETURNED]
 *                     returned_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Reserva já devolvida/cancelada
 *       404:
 *         description: Reserva não encontrada
 *       403:
 *         description: Sem permissão
 */

/**
 * @openapi
 * /reservations/{id}/cancel:
 *   post:
 *     summary: Cancela reserva (requer stock.reserve.cancel)
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reserva cancelada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 reservation:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       enum: [CANCELED]
 *       400:
 *         description: Reserva já cancelada/devolvida
 *       404:
 *         description: Reserva não encontrada
 *       403:
 *         description: Sem permissão stock.reserve.cancel
 */
