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
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [MASTER, USER]
 *         description: Filtrar por role
 *       - in: query
 *         name: blocked
 *         schema:
 *           type: string
 *           enum: ["0", "1", "true", "false"]
 *         description: Filtrar por bloqueado
 *     responses:
 *       200:
 *         description: Lista de usuários
 */

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Busca usuário por ID
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
 *         description: Usuário encontrado
 *       404:
 *         description: Usuário não encontrado
 */

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Cria usuário e funcionário (master only)
 *     description: Usuário recebe e-mail para definir senha no primeiro acesso.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, employee]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [MASTER, ADMIN, USER, ALMOX, CONTAB]
 *               empresa_id:
 *                 type: integer
 *                 nullable: true
 *                 description: >
 *                   ID da empresa vinculada ao usuário.
 *                   Obrigatório para perfis não-MASTER (ADMIN, USER, ALMOX, CONTAB etc).
 *                   Opcional para MASTER.
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
 *         description: Usuário criado, e-mail de primeiro acesso enviado
 *       403:
 *         description: Apenas master
 *       409:
 *         description: E-mail já existe
 *       500:
 *         description: Usuário criado, mas falha ao enviar e-mail (verifique integração Gmail)
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
 *                 enum: [MASTER, ADMIN, USER, ALMOX, CONTAB]
 *               empresa_id:
 *                 type: integer
 *                 nullable: true
 *                 description: >
 *                   ID da empresa vinculada ao usuário.
 *                   Obrigatório para perfis não-MASTER (ADMIN, USER, ALMOX, CONTAB etc).
 *                   Opcional para MASTER.
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

/**
 * @openapi
 * /users/pending-company-links:
 *   get:
 *     summary: Lista usuários não-MASTER sem empresa vinculada (pendências)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuários pendentes de vínculo com empresa
 *       403:
 *         description: Apenas MASTER pode acessar
 */

/**
 * @openapi
 * /users/pending-company-count:
 *   get:
 *     summary: Contagem de usuários não-MASTER sem empresa vinculada
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contagem de pendências de vínculo com empresa
 *       403:
 *         description: Apenas MASTER pode acessar
 */

/**
 * @openapi
 * /users/{id}/block:
 *   patch:
 *     summary: Bloquear ou desbloquear usuário
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
 *         description: Status invertido (bloqueado/desbloqueado)
 *       404:
 *         description: Usuário não encontrado
 */

/**
 * @openapi
 * /users/{id}/reset-password:
 *   post:
 *     summary: Redefinir senha do usuário
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Senha redefinida
 *       400:
 *         description: Senha inválida
 *       404:
 *         description: Usuário não encontrado
 */
