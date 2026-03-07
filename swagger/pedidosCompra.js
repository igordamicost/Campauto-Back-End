/**
 * @openapi
 * /pedidos-compra:
 *   get:
 *     summary: Lista pedidos de compra
 *     tags: [Pedidos de Compra]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Busca geral (número, etc.)
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [Pendente, Enviado, Cotado, Recebido, Cancelado] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string }
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: include
 *         schema: { type: string }
 *         description: "Ex: empresas para trazer dados da empresa vinculada"
 *     responses:
 *       200:
 *         description: Lista paginada de pedidos de compra
 */

/**
 * @openapi
 * /pedidos-compra/{id}:
 *   get:
 *     summary: Busca pedido de compra por ID
 *     tags: [Pedidos de Compra]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pedido encontrado
 *       404:
 *         description: Pedido não encontrado
 */

/**
 * @openapi
 * /pedidos-compra:
 *   post:
 *     summary: Criar pedido de compra
 *     tags: [Pedidos de Compra]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [empresa_id, json_itens]
 *             properties:
 *               orcamento_id:
 *                 type: integer
 *                 nullable: true
 *                 description: ID do orçamento vinculado (quando pedido criado a partir de orçamento)
 *               empresa_id:
 *                 type: integer
 *                 description: ID da empresa (obrigatório)
 *               data:
 *                 type: string
 *                 format: date
 *                 description: Data do pedido (YYYY-MM-DD)
 *               observacoes:
 *                 type: string
 *               json_itens:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     produto_id: { type: integer }
 *                     codigo_produto: { type: string }
 *                     produto: { type: string }
 *                     quantidade: { type: number }
 *                     unidade: { type: string }
 *                     preco_unitario: { type: number }
 *                     preco_custo: { type: number }
 *                     total: { type: number }
 *     responses:
 *       201:
 *         description: Pedido criado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: integer }
 *                 numero_sequencial: { type: integer }
 *       400:
 *         description: Dados inválidos
 */

/**
 * @openapi
 * /pedidos-compra/{id}:
 *   put:
 *     summary: Atualizar pedido de compra
 *     tags: [Pedidos de Compra]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               empresa_id: { type: integer }
 *               data: { type: string, format: date }
 *               status: { type: string, enum: [Pendente, Enviado, Cotado, Recebido, Cancelado] }
 *               observacoes: { type: string }
 *               json_itens: { type: array }
 *     responses:
 *       200:
 *         description: Pedido atualizado
 *       404:
 *         description: Pedido não encontrado
 */

/**
 * @openapi
 * /pedidos-compra/{id}:
 *   delete:
 *     summary: Excluir pedido de compra
 *     tags: [Pedidos de Compra]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pedido excluído
 *       404:
 *         description: Pedido não encontrado
 *       409:
 *         description: Pedido não pode ser excluído (apenas Pendente ou Cancelado)
 */

/**
 * @openapi
 * /pedidos-compra/{id}/status:
 *   patch:
 *     summary: Atualizar status do pedido (ex. cancelar)
 *     tags: [Pedidos de Compra]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
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
 *                 enum: [Pendente, Enviado, Cotado, Recebido, Cancelado]
 *     responses:
 *       200:
 *         description: Status atualizado
 *       404:
 *         description: Pedido não encontrado
 */

/**
 * @openapi
 * /pedidos-compra/{id}/enviar-fornecedores:
 *   post:
 *     summary: Enviar e-mail do pedido para fornecedores (multipart/form-data)
 *     tags: [Pedidos de Compra]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [fornecedor_ids]
 *             properties:
 *               fornecedor_ids:
 *                 type: string
 *                 description: "JSON string com array de IDs, ex: \"[1, 2, 3]\""
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF do pedido (gerado pelo frontend) - anexado a cada e-mail
 *     responses:
 *       200:
 *         description: Resultado do envio
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enviados: { type: integer }
 *                 erros:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       fornecedor_id: { type: integer }
 *                       mensagem: { type: string }
 *       404:
 *         description: Pedido não encontrado
 */
