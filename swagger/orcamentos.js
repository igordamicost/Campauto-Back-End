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
 *         description: Relacionamentos (clientes,empresas,veiculos,requer_pedido). requer_pedido adiciona pode_gerar_pedido em cada item
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
 * /orcamentos/{id}/requer-pedido-compra:
 *   get:
 *     summary: Verifica se o orçamento possui itens sem estoque (requer pedido de compra)
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
 *         description: Resultado da verificação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requer_pedido:
 *                   type: boolean
 *                 pode_gerar_pedido:
 *                   type: boolean
 *                 itens_sem_estoque:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       produto_id:
 *                         type: integer
 *                       descricao:
 *                         type: string
 *                       quantidade_solicitada:
 *                         type: number
 *                       saldo_estoque:
 *                         type: number
 *       404:
 *         description: Orçamento não encontrado
 */

/**
 * @openapi
 * /orcamentos/verificar-estoque:
 *   post:
 *     summary: Verifica estoque para vários orçamentos (batch)
 *     tags: [Orçamentos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orcamento_ids]
 *             properties:
 *               orcamento_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Mapa orcamento_id -> { pode_gerar_pedido }
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: object
 *                 properties:
 *                   pode_gerar_pedido:
 *                     type: boolean
 *       400:
 *         description: orcamento_ids inválido
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
 * /orcamentos/{id}/tags:
 *   patch:
 *     summary: Atualiza tags do orçamento (venda_realizada, venda_nao_realizada)
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
 *             required: [tags]
 *             properties:
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [venda_realizada, venda_nao_realizada]
 *     responses:
 *       200:
 *         description: Tags atualizadas
 *       404:
 *         description: Orçamento não encontrado
 */

/**
 * @openapi
 * /orcamentos/{id}/enviar-email:
 *   post:
 *     summary: Envia orçamento por e-mail ao cliente (multipart com PDF)
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
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF do orçamento
 *               email:
 *                 type: string
 *                 description: E-mail override (opcional)
 *     responses:
 *       200:
 *         description: E-mail enviado
 *       400:
 *         description: PDF ou e-mail do cliente ausente
 *       404:
 *         description: Orçamento não encontrado
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
