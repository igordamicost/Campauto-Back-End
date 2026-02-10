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
