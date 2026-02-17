/**
 * @openapi
 * /users:
 *   get:
 *     summary: Lista usuários
 *     tags: [Users]
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
 *         description: Busca por nome, email ou funcionário
 *     responses:
 *       200:
 *         description: Lista de usuários
 */

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Cria usuário e funcionário
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, employee]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [MASTER, USER]
 *               employee:
 *                 type: object
 *                 required: [full_name]
 *                 properties:
 *                   full_name:
 *                     type: string
 *                   phone:
 *                     type: string
 *     responses:
 *       201:
 *         description: Usuário criado
 *       403:
 *         description: Apenas MASTER
 */

/**
 * @openapi
 * /users/{id}:
 *   put:
 *     summary: Atualiza usuário e funcionário
 *     tags: [Users]
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
 *               role:
 *                 type: string
 *                 enum: [MASTER, USER]
 *               employee:
 *                 type: object
 *                 properties:
 *                   full_name:
 *                     type: string
 *                   phone:
 *                     type: string
 *     responses:
 *       200:
 *         description: Usuário atualizado
 *       404:
 *         description: Usuário não encontrado
 *       409:
 *         description: Email já existe
 */

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     summary: Remove usuário
 *     tags: [Users]
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
 *       404:
 *         description: Usuário não encontrado
 */
