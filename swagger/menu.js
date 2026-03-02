/**
 * @openapi
 * /menu:
 *   get:
 *     summary: Menu do usuário (filtrado por permissões)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Árvore de itens do menu que o usuário pode acessar
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   parent_id:
 *                     type: integer
 *                     nullable: true
 *                   module_key:
 *                     type: string
 *                   label:
 *                     type: string
 *                   path:
 *                     type: string
 *                   icon:
 *                     type: string
 *                   order:
 *                     type: integer
 *                   permission:
 *                     type: string
 *                   children:
 *                     type: array
 *       401:
 *         description: Não autenticado
 */

/**
 * @openapi
 * /admin/menu:
 *   get:
 *     summary: Lista todos os itens do menu (apenas DEV)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Árvore completa do menu
 *       403:
 *         description: Apenas role DEV pode acessar
 */

/**
 * @openapi
 * /admin/menu:
 *   post:
 *     summary: Cria item do menu (apenas DEV)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [label]
 *             properties:
 *               parent_id:
 *                 type: integer
 *                 nullable: true
 *               module_key:
 *                 type: string
 *               label:
 *                 type: string
 *               path:
 *                 type: string
 *               icon:
 *                 type: string
 *               order:
 *                 type: integer
 *               permission:
 *                 type: string
 *               permission_create:
 *                 type: string
 *               permission_update:
 *                 type: string
 *               permission_update_partial:
 *                 type: string
 *               permission_delete:
 *                 type: string
 *     responses:
 *       201:
 *         description: Item criado
 *       403:
 *         description: Apenas role DEV pode acessar
 */

/**
 * @openapi
 * /admin/menu/{id}:
 *   put:
 *     summary: Atualiza item do menu (apenas DEV)
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               parent_id:
 *                 type: integer
 *               module_key:
 *                 type: string
 *               label:
 *                 type: string
 *               path:
 *                 type: string
 *               icon:
 *                 type: string
 *               order:
 *                 type: integer
 *               permission:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item atualizado
 *       404:
 *         description: Item não encontrado
 *       403:
 *         description: Apenas role DEV pode acessar
 */

/**
 * @openapi
 * /admin/menu/{id}:
 *   delete:
 *     summary: Exclui item do menu (apenas DEV)
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
 *         description: Item excluído
 *       404:
 *         description: Item não encontrado
 *       403:
 *         description: Apenas role DEV pode acessar
 */
