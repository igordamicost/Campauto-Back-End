/**
 * @openapi
 * /admin/users:
 *   get:
 *     summary: Lista usuários (requer admin.users.manage)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Itens por página
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Busca por nome ou email
 *     responses:
 *       200:
 *         description: Lista de usuários
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
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       403:
 *         description: Sem permissão admin.users.manage
 */

/**
 * @openapi
 * /admin/users/{id}:
 *   get:
 *     summary: Busca usuário por ID com permissões
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
 *         description: Usuário encontrado
 *       404:
 *         description: Usuário não encontrado
 *       403:
 *         description: Sem permissão
 */

/**
 * @openapi
 * /admin/users:
 *   post:
 *     summary: Cria usuário (requer admin.users.manage)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role_id]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 6
 *               role_id:
 *                 type: integer
 *                 description: ID da role (1=MASTER, 2=ADMIN, 3=USER, 4=ALMOX, 5=CONTAB)
 *               cpf:
 *                 type: string
 *               telefone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuário criado
 *       400:
 *         description: Dados inválidos ou email já existe
 *       403:
 *         description: Sem permissão
 */

/**
 * @openapi
 * /admin/users/{id}:
 *   put:
 *     summary: Atualiza usuário (requer admin.users.manage)
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
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role_id:
 *                 type: integer
 *               cpf:
 *                 type: string
 *               telefone:
 *                 type: string
 *               blocked:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Usuário atualizado
 *       404:
 *         description: Usuário não encontrado
 *       403:
 *         description: Sem permissão
 */

/**
 * @openapi
 * /admin/users/{id}:
 *   delete:
 *     summary: Remove usuário (requer admin.users.manage)
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
 *         description: Usuário removido
 *       400:
 *         description: Não é possível remover (ex: último admin)
 *       404:
 *         description: Usuário não encontrado
 *       403:
 *         description: Sem permissão
 */

/**
 * @openapi
 * /admin/roles:
 *   get:
 *     summary: Lista todas as roles (requer admin.roles.manage)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de roles
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
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                         enum: [MASTER, ADMIN, USER, ALMOX, CONTAB]
 *                       description:
 *                         type: string
 *       403:
 *         description: Sem permissão admin.roles.manage
 */

/**
 * @openapi
 * /admin/permissions:
 *   get:
 *     summary: Lista todas as permissões (requer admin.roles.manage)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de permissões
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
 *                       id:
 *                         type: integer
 *                       key:
 *                         type: string
 *                         example: sales.read
 *                       description:
 *                         type: string
 *                       module:
 *                         type: string
 *                         example: vendas
 *       403:
 *         description: Sem permissão admin.roles.manage
 */

/**
 * @openapi
 * /admin/roles/{id}/permissions:
 *   get:
 *     summary: Busca permissões de uma role (requer admin.roles.manage)
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
 *         description: Permissões da role
 *       404:
 *         description: Role não encontrada
 *       403:
 *         description: Sem permissão
 */

/**
 * @openapi
 * /admin/roles/{id}/permissions:
 *   put:
 *     summary: Atualiza permissões de uma role (requer admin.roles.manage)
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permission_ids]
 *             properties:
 *               permission_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3, 5, 8]
 *     responses:
 *       200:
 *         description: Permissões atualizadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 role_id:
 *                   type: integer
 *                 permissions:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: IDs de permissão inválidos
 *       404:
 *         description: Role não encontrada
 *       403:
 *         description: Sem permissão
 */
