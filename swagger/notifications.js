/**
 * @openapi
 * /notifications:
 *   get:
 *     summary: Lista notificações do usuário logado
 *     tags: [Notificações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *         description: Filtrar por lidas (true/false)
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
 *         description: Lista de notificações
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
 *                       type:
 *                         type: string
 *                         enum: [RESERVATION_DUE_SOON, RESERVATION_OVERDUE, RESERVATION_DUE_SOON_MANAGER, RESERVATION_OVERDUE_MANAGER]
 *                       title:
 *                         type: string
 *                       message:
 *                         type: string
 *                       is_read:
 *                         type: boolean
 *                       read_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       metadata:
 *                         type: object
 *                         description: Dados adicionais exemplo reservation_id product_id
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *       401:
 *         description: Não autenticado
 */

/**
 * @openapi
 * /notifications/{id}/read:
 *   post:
 *     summary: Marca notificação como lida
 *     tags: [Notificações]
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
 *         description: Notificação marcada como lida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Notificação não encontrada
 *       401:
 *         description: Não autenticado
 */
