/**
 * @openapi
 * /admin/commission-rules:
 *   get:
 *     summary: Lista regras de comissão (requer MASTER)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: rule_type
 *         schema:
 *           type: string
 *           enum: [DEFAULT, BY_SALESPERSON, BY_PRODUCT, BY_CATEGORY]
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Lista de regras de comissão
 *       403:
 *         description: Acesso negado (apenas MASTER)
 */

/**
 * @openapi
 * /admin/commission-rules/{id}:
 *   get:
 *     summary: Busca regra de comissão por ID (requer MASTER)
 *     tags: [Admin]
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
 *         description: Regra encontrada
 *       404:
 *         description: Regra não encontrada
 *       403:
 *         description: Acesso negado (apenas MASTER)
 */

/**
 * @openapi
 * /admin/commission-rules:
 *   post:
 *     summary: Cria regra de comissão (requer MASTER)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rule_type, commission_rate]
 *             properties:
 *               rule_type:
 *                 type: string
 *                 enum: [DEFAULT, BY_SALESPERSON, BY_PRODUCT, BY_CATEGORY]
 *               salesperson_user_id:
 *                 type: integer
 *                 description: Obrigatório se rule_type=BY_SALESPERSON
 *               product_id:
 *                 type: integer
 *                 description: Obrigatório se rule_type=BY_PRODUCT
 *               category:
 *                 type: string
 *                 description: Obrigatório se rule_type=BY_CATEGORY
 *               commission_rate:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Percentual de comissão (exemplo 5.00 = 5%)
 *               is_active:
 *                 type: boolean
 *                 default: true
 *               priority:
 *                 type: integer
 *                 default: 0
 *                 description: Prioridade (maior = mais específica)
 *     responses:
 *       201:
 *         description: Regra criada
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Acesso negado (apenas MASTER)
 */

/**
 * @openapi
 * /admin/commission-rules/{id}:
 *   put:
 *     summary: Atualiza regra de comissão (requer MASTER)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               commission_rate:
 *                 type: number
 *               is_active:
 *                 type: boolean
 *               priority:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Regra atualizada
 *       404:
 *         description: Regra não encontrada
 *       403:
 *         description: Acesso negado (apenas MASTER)
 */

/**
 * @openapi
 * /admin/commission-rules/{id}:
 *   delete:
 *     summary: Remove regra de comissão (requer MASTER)
 *     tags: [Admin]
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
 *         description: Regra excluída
 *       404:
 *         description: Regra não encontrada
 *       403:
 *         description: Acesso negado (apenas MASTER)
 */
