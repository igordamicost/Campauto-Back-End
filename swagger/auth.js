/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token JWT
 *       401:
 *         description: Credenciais inválidas
 */

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Envia email de recuperação
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: cliente@gmail.com
 *     responses:
 *       200:
 *         description: Se o email existir, você receberá instruções
 */

/**
 * @openapi
 * /auth/set-password:
 *   post:
 *     summary: Define senha com token (primeiro acesso ou recuperação)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: Mínimo 8 caracteres, 1 letra e 1 número
 *     responses:
 *       200:
 *         description: Senha alterada com sucesso
 *       400:
 *         description: Token inválido ou senha fraca
 */

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Obter dados do usuário logado com permissões
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário com role e permissões
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                       enum: [MASTER, ADMIN, USER, ALMOX, CONTAB]
 *                     description:
 *                       type: string
 *                 permissions:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["sales.read", "stock.read", "stock.reserve.create"]
 *                 permissionsDetail:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       key:
 *                         type: string
 *                       description:
 *                         type: string
 *                       module:
 *                         type: string
 *       401:
 *         description: Token inválido ou expirado
 *       404:
 *         description: Usuário não encontrado
 */
