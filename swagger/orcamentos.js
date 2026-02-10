/**
 * @openapi
 * /orcamentos:
 *   get:
 *     summary: Lista orçamentos
 *     tags: [Orçamentos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Página (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Itens por página (default 10)
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *         description: Alias de limit
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Busca geral por texto
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Coluna para ordenação
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Direção da ordenação
 *       - in: query
 *         name: include
 *         schema:
 *           type: string
 *         description: Relacionamentos (clientes,empresas,veiculos)
 *     responses:
 *       200:
 *         description: Lista de orçamentos
 */

/**
 * @openapi
 * /orcamentos/{id}:
 *   get:
 *     summary: Busca orçamento por ID
 *     tags: [Orçamentos]
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
 *         description: Orçamento encontrado
 *       404:
 *         description: Orçamento não encontrado
 */

/**
 * @openapi
 * /orcamentos:
 *   post:
 *     summary: Cria orçamento
 *     tags: [Orçamentos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cliente_id, data]
 *             properties:
 *               cliente_id:
 *                 type: integer
 *               empresa_id:
 *                 type: integer
 *               veiculo_id:
 *                 type: integer
 *               data:
 *                 type: string
 *                 format: date
 *               prazo_entrega:
 *                 type: string
 *               validade:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [Cotação, Aprovado, Separado, Faturado, Cancelado]
 *               json_itens:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     produto:
 *                       type: string
 *                     quantidade:
 *                       type: number
 *                     unidade:
 *                       type: string
 *                     preco_unitario:
 *                       type: number
 *                     total:
 *                       type: number
 *               desconto:
 *                 type: number
 *     responses:
 *       201:
 *         description: Orçamento criado
 */

/**
 * @openapi
 * /orcamentos/{id}:
 *   put:
 *     summary: Atualiza orçamento
 *     tags: [Orçamentos]
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
 *     responses:
 *       200:
 *         description: Orçamento atualizado
 */

/**
 * @openapi
 * /orcamentos/{id}/status:
 *   patch:
 *     summary: Atualiza status do orçamento
 *     tags: [Orçamentos]
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Cotação, Aprovado, Separado, Faturado, Cancelado]
 *     responses:
 *       200:
 *         description: Status atualizado
 */

/**
 * @openapi
 * /orcamentos/{id}:
 *   delete:
 *     summary: Remove orçamento
 *     tags: [Orçamentos]
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
 *         description: Orçamento removido
 */
