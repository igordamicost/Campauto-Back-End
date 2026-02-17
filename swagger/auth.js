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
