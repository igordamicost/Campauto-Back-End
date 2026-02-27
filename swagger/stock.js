/**
 * @openapi
 * /stock/balances:
 *   get:
 *     summary: Lista saldos de estoque por produto e empresa (requer stock.read)
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
 *         name: empresa_id
 *         schema:
 *           type: integer
 *         description: Filtrar por empresa (loja)
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Busca por código, descrição ou código de fábrica
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 2000
 *     responses:
 *       200:
 *         description: Lista de saldos (um por combinação produto + empresa)
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
 *                       product_id:
 *                         type: integer
 *                       product_code:
 *                         type: string
 *                       product_factory_code:
 *                         type: string
 *                       product_name:
 *                         type: string
 *                       empresa_id:
 *                         type: integer
 *                       empresa_nome:
 *                         type: string
 *                       qty_on_hand:
 *                         type: number
 *                         description: Quantidade física em estoque
 *                       qty_reserved:
 *                         type: number
 *                         description: Quantidade reservada
 *                       qty_pending_nf:
 *                         type: number
 *                         description: Quantidade faturada aguardando NF
 *                       qty_available:
 *                         type: number
 *                         description: Disponível (on_hand - reserved - pending_nf)
 *                 total:
 *                   type: integer
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
 *         name: empresa_id
 *         schema:
 *           type: integer
 *         description: Filtrar por empresa (loja)
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
 *               empresa_id:
 *                 type: integer
 *                 description: ID da empresa (loja) onde a movimentação ocorre
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
 *         name: empresa_id
 *         schema:
 *           type: integer
 *         description: Empresa (loja) onde deseja verificar disponibilidade
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

/**
 * @openapi
 * /stock/entries:
 *   post:
 *     summary: Entrada de estoque (manual ou código de barras) (requer stock.move)
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_id, empresa_id, quantity]
 *             properties:
 *               product_id:
 *                 type: integer
 *               empresa_id:
 *                 type: integer
 *                 description: Empresa (loja) que recebe o estoque
 *               quantity:
 *                 type: number
 *               tipo:
 *                 type: string
 *                 description: "entrada_manual" ou "entrada_barras"
 *               observacao:
 *                 type: string
 *     responses:
 *       201:
 *         description: Entrada registrada
 *       403:
 *         description: Sem permissão stock.move
 */

/**
 * @openapi
 * /stock/products/by-barcode:
 *   get:
 *     summary: Busca produto por código de barras (requer stock.read)
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: barcode
 *         required: true
 *         schema:
 *           type: string
 *         description: Código de barras do produto
 *     responses:
 *       200:
 *         description: Produto encontrado
 *       404:
 *         description: Produto não encontrado
 *       403:
 *         description: Sem permissão
 */

/**
 * @openapi
 * /stock/import-xml:
 *   post:
 *     summary: Importa XML de pedido/fábrica e dá entrada no estoque (requer stock.move)
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [empresa_id, xml]
 *             properties:
 *               empresa_id:
 *                 type: integer
 *                 description: Empresa (loja) que recebe o estoque
 *               xml:
 *                 type: string
 *                 description: Conteúdo XML do pedido/NF
 *     responses:
 *       201:
 *         description: XML processado, entradas de estoque criadas
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Sem permissão stock.move
 */

/**
 * @openapi
 * /stock/compras:
 *   get:
 *     summary: Lista compras
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: fornecedor_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [RASCUNHO, PENDENTE, FINALIZADA, CANCELADA]
 *       - in: query
 *         name: data_inicio
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: data_fim
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de compras paginada
 */

/**
 * @openapi
 * /stock/compras/{id}:
 *   get:
 *     summary: Busca compra por ID com itens
 *     tags: [Estoque]
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
 *         description: Compra encontrada com itens
 *       404:
 *         description: Compra não encontrada
 */

/**
 * @openapi
 * /stock/compras:
 *   post:
 *     summary: Cria compra
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [data, itens]
 *             properties:
 *               fornecedor_id:
 *                 type: integer
 *               data:
 *                 type: string
 *                 format: date
 *               data_entrega:
 *                 type: string
 *                 format: date
 *               desconto:
 *                 type: number
 *                 default: 0
 *               observacoes:
 *                 type: string
 *               itens:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [produto_id, quantidade, valor_unitario]
 *                   properties:
 *                     produto_id:
 *                       type: integer
 *                     quantidade:
 *                       type: number
 *                       minimum: 0.001
 *                     valor_unitario:
 *                       type: number
 *                       minimum: 0.01
 *     responses:
 *       201:
 *         description: Compra criada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 */

/**
 * @openapi
 * /stock/compras/{id}:
 *   put:
 *     summary: Atualiza compra
 *     tags: [Estoque]
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
 *         description: Compra atualizada
 *       409:
 *         description: Compra finalizada não pode ser editada
 */

/**
 * @openapi
 * /stock/compras/{id}:
 *   delete:
 *     summary: Remove compra
 *     tags: [Estoque]
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
 *         description: Compra excluída
 *       409:
 *         description: Compra finalizada não pode ser excluída
 */

/**
 * @openapi
 * /stock/compras/{id}/finalizar:
 *   patch:
 *     summary: Finaliza compra e cria movimentações de estoque
 *     tags: [Estoque]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     description: |
 *       Finaliza a compra alterando status para FINALIZADA e:
 *       - Cria movimentações de estoque (ENTRY) para cada item
 *       - Atualiza saldos de estoque (stock_balances)
 *       - Opcionalmente cria conta a pagar se fornecedor informado
 *     responses:
 *       200:
 *         description: Compra finalizada com sucesso
 *       409:
 *         description: Compra já está finalizada ou cancelada
 *       400:
 *         description: Compra não possui itens
 */
