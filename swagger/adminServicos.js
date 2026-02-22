/**
 * @openapi
 * /admin/servicos:
 *   get:
 *     summary: Lista serviços (requer admin.users.manage)
 *     tags: [Admin - Serviços]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Busca por nome, código ou descrição
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Lista paginada { data, total, page, perPage }
 *       403:
 *         description: Sem permissão
 */

/**
 * @openapi
 * /admin/servicos/{id}:
 *   get:
 *     summary: Retorna um serviço por ID
 *     tags: [Admin - Serviços]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Serviço { id, nome, codigo, descricao, created_at, updated_at }
 *       404:
 *         description: Serviço não encontrado
 */

/**
 * @openapi
 * /admin/servicos:
 *   post:
 *     summary: Cria um serviço
 *     tags: [Admin - Serviços]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome]
 *             properties:
 *               nome: { type: string }
 *               codigo: { type: string }
 *               descricao: { type: string }
 *     responses:
 *       201:
 *         description: Serviço criado
 *       400:
 *         description: nome obrigatório
 */

/**
 * @openapi
 * /admin/servicos/{id}:
 *   put:
 *     summary: Atualiza um serviço
 *     tags: [Admin - Serviços]
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
 *               codigo: { type: string }
 *               descricao: { type: string }
 *     responses:
 *       200:
 *         description: Serviço atualizado
 *       404:
 *         description: Serviço não encontrado
 */

/**
 * @openapi
 * /admin/servicos/{id}:
 *   delete:
 *     summary: Exclui um serviço (itens do checklist em cascata)
 *     tags: [Admin - Serviços]
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
 *         description: Serviço não encontrado
 */

/**
 * @openapi
 * /admin/servicos/{servicoId}/itens:
 *   get:
 *     summary: Lista itens do checklist do serviço
 *     tags: [Admin - Serviços]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: servicoId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Array de itens { id, descricao, nome, ordem, servico_id }
 *       404:
 *         description: Serviço não encontrado
 */

/**
 * @openapi
 * /admin/servicos/{servicoId}/itens:
 *   post:
 *     summary: Adiciona item ao checklist do serviço
 *     tags: [Admin - Serviços]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: servicoId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [descricao]
 *             properties:
 *               descricao: { type: string }
 *               ordem: { type: integer }
 *     responses:
 *       201:
 *         description: Item criado
 *       400:
 *         description: descricao obrigatória
 *       404:
 *         description: Serviço não encontrado
 */

/**
 * @openapi
 * /admin/servicos/{servicoId}/itens/{id}:
 *   put:
 *     summary: Atualiza item do checklist
 *     tags: [Admin - Serviços]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: servicoId
 *         required: true
 *         schema: { type: integer }
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
 *               descricao: { type: string }
 *               ordem: { type: integer }
 *     responses:
 *       200:
 *         description: Item atualizado
 *       404:
 *         description: Item não encontrado
 */

/**
 * @openapi
 * /admin/servicos/{servicoId}/itens/{id}:
 *   delete:
 *     summary: Remove item do checklist
 *     tags: [Admin - Serviços]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: servicoId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Removido
 *       404:
 *         description: Item não encontrado
 */
