/**
 * @openapi
 * /email-templates:
 *   get:
 *     summary: Lista templates de e-mail (FIRST_ACCESS, RESET, SUPPLIER_ORDER, CLIENT_QUOTE)
 *     tags: [Email Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de templates (um por templateKey)
 */

/**
 * @openapi
 * /email-templates/{templateKey}:
 *   put:
 *     summary: Atualiza template (upsert)
 *     tags: [Email Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateKey
 *         required: true
 *         schema:
 *           type: string
 *           enum: [FIRST_ACCESS, RESET, SUPPLIER_ORDER, CLIENT_QUOTE]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, subject, htmlBody]
 *             properties:
 *               name:
 *                 type: string
 *               subject:
 *                 type: string
 *                 maxLength: 160
 *               htmlBody:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Template salvo
 */

/**
 * @openapi
 * /email-templates/{templateKey}/preview:
 *   post:
 *     summary: Preview com dados mock
 *     tags: [Email Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateKey
 *         required: true
 *         schema:
 *           type: string
 *           enum: [FIRST_ACCESS, RESET, SUPPLIER_ORDER, CLIENT_QUOTE]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, htmlBody]
 *             properties:
 *               subject:
 *                 type: string
 *               htmlBody:
 *                 type: string
 *     responses:
 *       200:
 *         description: subject/htmlBody renderizados para preview
 */
