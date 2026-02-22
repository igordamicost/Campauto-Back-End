/**
 * @openapi
 * /fornecedores:
 *   get:
 *     summary: Lista fornecedores
 *     tags: [Fornecedores]
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
 *         name: perPage
 *         schema: { type: integer }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Busca por nome fantasia, razão social, CNPJ, etc.
 *       - in: query
 *         name: sortBy
 *         schema: { type: string }
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Lista paginada
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
*                       id: { type: integer }
*                       nome_fantasia: { type: string }
*                       razao_social: { type: string }
*                       cnpj: { type: string }
*                       endereco: { type: string }
*                       telefone: { type: string }
*                       email: { type: string }
*                       responsavel: { type: string }
 *                 page: { type: integer }
 *                 perPage: { type: integer }
 *                 total: { type: integer }
 *                 totalPages: { type: integer }
 */

/**
 * @openapi
 * /fornecedores/{id}:
 *   get:
 *     summary: Fornecedor por ID
 *     tags: [Fornecedores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Fornecedor encontrado
 *       404:
 *         description: Fornecedor não encontrado
 */

/**
 * @openapi
 * /fornecedores:
 *   post:
 *     summary: Criar fornecedor
 *     tags: [Fornecedores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cnpj: { type: string }
 *               nome_fantasia: { type: string }
 *               razao_social: { type: string }
 *               endereco: { type: string }
 *               telefone: { type: string }
 *               email: { type: string }
 *               responsavel: { type: string }
 *     responses:
 *       201:
 *         description: Fornecedor criado
 *       409:
 *         description: Duplicado ou inválido
 */

/**
 * @openapi
 * /fornecedores/{id}:
 *   put:
 *     summary: Atualizar fornecedor
 *     tags: [Fornecedores]
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
 *               cnpj: { type: string }
 *               nome_fantasia: { type: string }
 *               razao_social: { type: string }
 *               endereco: { type: string }
 *               telefone: { type: string }
 *               email: { type: string }
 *               responsavel: { type: string }
 *     responses:
 *       200:
 *         description: Fornecedor atualizado
 *       404:
 *         description: Fornecedor não encontrado
 */

/**
 * @openapi
 * /fornecedores/{id}:
 *   delete:
 *     summary: Excluir fornecedor
 *     tags: [Fornecedores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Excluído
 *       404:
 *         description: Fornecedor não encontrado
 *       409:
 *         description: Não permitido (ex.: compras vinculadas)
 */
