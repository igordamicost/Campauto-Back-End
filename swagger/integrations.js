/**
 * @openapi
 * /integrations/google-mail:
 *   post:
 *     summary: Configura integração Gmail (OAuth)
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [senderEmail, clientId, clientSecret, refreshToken]
 *             properties:
 *               senderEmail:
 *                 type: string
 *                 format: email
 *               clientId:
 *                 type: string
 *               clientSecret:
 *                 type: string
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Configuração salva
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Apenas master
 */

/**
 * @openapi
 * /integrations/google-mail/test:
 *   post:
 *     summary: Envia e-mail de teste via Gmail API
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: E-mail de teste enviado
 *       500:
 *         description: Falha ao enviar (integração ou permissões)
 */
