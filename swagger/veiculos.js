/**
 * @openapi
 * /veiculos:
 *   get:
 *     summary: Lista veículos
 *     tags: [Veículos]
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
 *           default: 20
 *       - in: query
 *         name: cliente_id
 *         schema:
 *           type: integer
 *         description: Filtrar por cliente
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Busca em marca, modelo, placa, renavan
 *     responses:
 *       200:
 *         description: Lista de veículos paginada
 */

/**
 * @openapi
 * /veiculos/{id}:
 *   get:
 *     summary: Busca veículo por ID
 *     tags: [Veículos]
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
 *         description: Veículo encontrado
 *       404:
 *         description: Veículo não encontrado
 */

/**
 * @openapi
 * /veiculos:
 *   post:
 *     summary: Cria veículo
 *     tags: [Veículos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cliente_id]
 *             properties:
 *               cliente_id:
 *                 type: integer
 *               marca:
 *                 type: string
 *               modelo:
 *                 type: string
 *               placa:
 *                 type: string
 *               ano:
 *                 type: string
 *               renavan:
 *                 type: string
 *               chassi:
 *                 type: string
 *               cor:
 *                 type: string
 *     description: Pelo menos marca ou placa deve ser informado
 *     responses:
 *       201:
 *         description: Veículo criado
 *       400:
 *         description: Dados inválidos (cliente_id obrigatório, marca ou placa obrigatório)
 */

/**
 * @openapi
 * /veiculos/{id}:
 *   put:
 *     summary: Atualiza veículo
 *     tags: [Veículos]
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
 *               marca:
 *                 type: string
 *               modelo:
 *                 type: string
 *               placa:
 *                 type: string
 *               ano:
 *                 type: string
 *               renavan:
 *                 type: string
 *               chassi:
 *                 type: string
 *               cor:
 *                 type: string
 *     responses:
 *       200:
 *         description: Veículo atualizado
 *       404:
 *         description: Veículo não encontrado
 */

/**
 * @openapi
 * /veiculos/{id}:
 *   delete:
 *     summary: Remove veículo
 *     tags: [Veículos]
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
 *         description: Veículo excluído
 *       404:
 *         description: Veículo não encontrado
 *       409:
 *         description: Veículo está vinculado a orçamento(s)
 */
