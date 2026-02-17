/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check da API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API está funcionando
 */

/**
 * @openapi
 * /health/email:
 *   get:
 *     summary: Envia e-mail de teste (SMTP)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: E-mail enviado
 *       500:
 *         description: Falha ao enviar
 */
