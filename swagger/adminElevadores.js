/**
 * @openapi
 * /admin/elevadores:
 *   get:
 *     summary: Lista elevadores (requer admin.users.manage)
 *     tags: [Admin - Elevadores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: empresa_id
 *         schema: { type: integer }
 *         description: Filtrar por empresa
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *     responses:
 *       200:
 *         description: Lista paginada { data, total, page, perPage }. Cada item tem id, nome, empresa_id, empresa_nome, empresa.
 *       403:
 *         description: Sem permissão
 */

/**
 * @openapi
 * /admin/elevadores/{id}:
 *   get:
 *     summary: Retorna um elevador por ID
 *     tags: [Admin - Elevadores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Elevador com empresa_nome e objeto empresa
 *       404:
 *         description: Elevador não encontrado
 */

/**
 * @openapi
 * /admin/elevadores:
 *   post:
 *     summary: Cria um elevador
 *     tags: [Admin - Elevadores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, empresa_id]
 *             properties:
 *               nome: { type: string }
 *               empresa_id: { type: integer }
 *     responses:
 *       201:
 *         description: Elevador criado
 *       400:
 *         description: nome ou empresa_id obrigatório / empresa_id inválido
 */

/**
 * @openapi
 * /admin/elevadores/{id}:
 *   put:
 *     summary: Atualiza um elevador
 *     tags: [Admin - Elevadores]
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
 *               nome: { type: string }
 *               empresa_id: { type: integer }
 *     responses:
 *       200:
 *         description: Elevador atualizado
 *       404:
 *         description: Elevador não encontrado
 */

/**
 * @openapi
 * /admin/elevadores/{id}:
 *   delete:
 *     summary: Exclui um elevador
 *     tags: [Admin - Elevadores]
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
 *         description: Elevador não encontrado
 *       409:
 *         description: Orçamentos vinculados no pátio
 */

/**
 * @openapi
 * /oficina/elevadores:
 *   get:
 *     summary: Lista elevadores para o Pátio (requer service_orders.read)
 *     tags: [Oficina - Pátio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: empresa_id
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Mesma estrutura de GET /admin/elevadores { data, total, page, perPage }
 *       403:
 *         description: Sem permissão de oficina
 */
