/**
 * @openapi
 * /financeiro/contas-receber:
 *   get:
 *     summary: Lista contas a receber
 *     tags: [Financeiro]
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
 *         name: cliente_id
 *         schema:
 *           type: integer
 *         description: Filtrar por cliente
 *       - in: query
 *         name: pago
 *         schema:
 *           type: boolean
 *         description: Filtrar por status de pagamento
 *       - in: query
 *         name: vencimento_inicio
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial do vencimento (YYYY-MM-DD)
 *       - in: query
 *         name: vencimento_fim
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final do vencimento (YYYY-MM-DD)
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Busca geral em descrição e observações
 *       - in: query
 *         name: include
 *         schema:
 *           type: string
 *         description: Relacionamentos (clientes)
 *     responses:
 *       200:
 *         description: Lista de contas a receber paginada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 page:
 *                   type: integer
 *                 perPage:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 */

/**
 * @openapi
 * /financeiro/contas-receber/{id}:
 *   get:
 *     summary: Busca conta a receber por ID
 *     tags: [Financeiro]
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
 *         description: Conta a receber encontrada
 *       404:
 *         description: Conta a receber não encontrada
 */

/**
 * @openapi
 * /financeiro/contas-receber:
 *   post:
 *     summary: Cria conta a receber
 *     tags: [Financeiro]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cliente_id, descricao, valor, vencimento]
 *             properties:
 *               cliente_id:
 *                 type: integer
 *               descricao:
 *                 type: string
 *               valor:
 *                 type: number
 *                 minimum: 0.01
 *               vencimento:
 *                 type: string
 *                 format: date
 *               observacoes:
 *                 type: string
 *               orcamento_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Conta a receber criada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *       400:
 *         description: Dados inválidos
 */

/**
 * @openapi
 * /financeiro/contas-receber/{id}:
 *   put:
 *     summary: Atualiza conta a receber
 *     tags: [Financeiro]
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
 *               cliente_id:
 *                 type: integer
 *               descricao:
 *                 type: string
 *               valor:
 *                 type: number
 *               vencimento:
 *                 type: string
 *                 format: date
 *               observacoes:
 *                 type: string
 *               orcamento_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Conta atualizada
 *       409:
 *         description: Conta já foi paga e não pode ser editada
 */

/**
 * @openapi
 * /financeiro/contas-receber/{id}:
 *   delete:
 *     summary: Remove conta a receber
 *     tags: [Financeiro]
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
 *         description: Conta excluída
 *       409:
 *         description: Conta já foi paga e não pode ser excluída
 */

/**
 * @openapi
 * /financeiro/contas-receber/{id}/pagar:
 *   patch:
 *     summary: Marca conta a receber como paga
 *     tags: [Financeiro]
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
 *               forma_pagamento:
 *                 type: string
 *               conta_caixa_id:
 *                 type: integer
 *                 description: ID da conta de caixa para criar movimentação
 *     responses:
 *       200:
 *         description: Conta marcada como paga
 *       409:
 *         description: Conta já foi paga
 */

/**
 * @openapi
 * /financeiro/contas-pagar:
 *   get:
 *     summary: Lista contas a pagar
 *     tags: [Financeiro]
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
 *         name: pago
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: vencimento_inicio
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: vencimento_fim
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de contas a pagar paginada
 */

/**
 * @openapi
 * /financeiro/contas-pagar/{id}:
 *   get:
 *     summary: Busca conta a pagar por ID
 *     tags: [Financeiro]
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
 *         description: Conta a pagar encontrada
 *       404:
 *         description: Conta a pagar não encontrada
 */

/**
 * @openapi
 * /financeiro/contas-pagar:
 *   post:
 *     summary: Cria conta a pagar
 *     tags: [Financeiro]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [descricao, valor, vencimento]
 *             properties:
 *               fornecedor_id:
 *                 type: integer
 *               descricao:
 *                 type: string
 *               valor:
 *                 type: number
 *                 minimum: 0.01
 *               vencimento:
 *                 type: string
 *                 format: date
 *               observacoes:
 *                 type: string
 *               compra_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Conta a pagar criada
 */

/**
 * @openapi
 * /financeiro/contas-pagar/{id}:
 *   put:
 *     summary: Atualiza conta a pagar
 *     tags: [Financeiro]
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
 *         description: Conta atualizada
 *       409:
 *         description: Conta já foi paga e não pode ser editada
 */

/**
 * @openapi
 * /financeiro/contas-pagar/{id}:
 *   delete:
 *     summary: Remove conta a pagar
 *     tags: [Financeiro]
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
 *         description: Conta excluída
 *       409:
 *         description: Conta já foi paga e não pode ser excluída
 */

/**
 * @openapi
 * /financeiro/contas-pagar/{id}/pagar:
 *   patch:
 *     summary: Marca conta a pagar como paga
 *     tags: [Financeiro]
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
 *               forma_pagamento:
 *                 type: string
 *               conta_caixa_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Conta marcada como paga
 */

/**
 * @openapi
 * /financeiro/caixa:
 *   get:
 *     summary: Lista contas de caixa/banco
 *     tags: [Financeiro]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [CAIXA, BANCO]
 *     responses:
 *       200:
 *         description: Lista de contas com saldo atual calculado
 */

/**
 * @openapi
 * /financeiro/caixa/{id}:
 *   get:
 *     summary: Busca conta de caixa/banco por ID
 *     tags: [Financeiro]
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
 *         description: Conta encontrada com saldo atual
 */

/**
 * @openapi
 * /financeiro/caixa:
 *   post:
 *     summary: Cria conta de caixa/banco
 *     tags: [Financeiro]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, tipo]
 *             properties:
 *               nome:
 *                 type: string
 *               tipo:
 *                 type: string
 *                 enum: [CAIXA, BANCO]
 *               banco:
 *                 type: string
 *                 description: Obrigatório se tipo=BANCO
 *               agencia:
 *                 type: string
 *                 description: Obrigatório se tipo=BANCO
 *               conta:
 *                 type: string
 *                 description: Obrigatório se tipo=BANCO
 *               saldo_inicial:
 *                 type: number
 *                 default: 0
 *     responses:
 *       201:
 *         description: Conta criada
 *       409:
 *         description: Já existe uma conta com este nome
 */

/**
 * @openapi
 * /financeiro/caixa/{id}:
 *   put:
 *     summary: Atualiza conta de caixa/banco
 *     tags: [Financeiro]
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
 *         description: Conta atualizada
 */

/**
 * @openapi
 * /financeiro/caixa/{id}:
 *   delete:
 *     summary: Remove conta de caixa/banco
 *     tags: [Financeiro]
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
 *         description: Conta excluída
 *       409:
 *         description: Conta possui movimentações vinculadas
 */

/**
 * @openapi
 * /financeiro/caixa/{id}/extrato:
 *   get:
 *     summary: Busca extrato de movimentações da conta
 *     tags: [Financeiro]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
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
 *     responses:
 *       200:
 *         description: Extrato com saldo inicial e final do período
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conta:
 *                   type: object
 *                 periodo:
 *                   type: object
 *                 saldo_inicial:
 *                   type: number
 *                 saldo_final:
 *                   type: number
 *                 movimentacoes:
 *                   type: array
 */

/**
 * @openapi
 * /financeiro/caixa/saldos:
 *   get:
 *     summary: Retorna resumo de saldos de todas as contas
 *     tags: [Financeiro]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumo consolidado de saldos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_caixa:
 *                   type: number
 *                 total_banco:
 *                   type: number
 *                 total_geral:
 *                   type: number
 *                 contas:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       nome:
 *                         type: string
 *                       tipo:
 *                         type: string
 *                       saldo_atual:
 *                         type: number
 */

/**
 * @openapi
 * /financeiro/caixa/movimentacoes:
 *   post:
 *     summary: Cria movimentação manual de caixa
 *     tags: [Financeiro]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [conta_caixa_id, tipo, valor, descricao, data]
 *             properties:
 *               conta_caixa_id:
 *                 type: integer
 *               tipo:
 *                 type: string
 *                 enum: [ENTRADA, SAIDA]
 *               valor:
 *                 type: number
 *                 minimum: 0.01
 *               descricao:
 *                 type: string
 *               data:
 *                 type: string
 *                 format: date
 *               forma_pagamento:
 *                 type: string
 *               observacoes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Movimentação criada
 */
