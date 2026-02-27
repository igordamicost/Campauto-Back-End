/**
 * @openapi
 * /empresas:
 *   get:
 *     summary: Lista empresas
 *     tags: [Empresas]
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
 *         description: Busca geral por texto
 *       - in: query
 *         name: cidade
 *         schema:
 *           type: string
 *         description: Filtrar por cidade
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *         description: Filtrar por estado
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Coluna para ordenação
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Direção da ordenação
 *       - in: query
 *         name: <coluna>
 *         schema:
 *           type: string
 *         description: Filtro por coluna (qualquer coluna da tabela)
 *     responses:
 *       200:
 *         description: Lista de empresas
 */

/**
 * @openapi
 * /empresas/{id}:
 *   get:
 *     summary: Busca empresa por ID
 *     tags: [Empresas]
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
 *         description: Empresa encontrada
 *       404:
 *         description: Empresa não encontrada
 */

/**
 * @openapi
 * /empresas:
 *   post:
 *     summary: Cria empresa
 *     tags: [Empresas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome_fantasia]
 *             properties:
 *               nome_fantasia:
 *                 type: string
 *               razao_social:
 *                 type: string
 *               cnpj:
 *                 type: string
 *               endereco:
 *                 type: string
 *               cep:
 *                 type: string
 *               email:
 *                 type: string
 *               cidade:
 *                 type: string
 *               telefone:
 *                 type: string
 *               estado:
 *                 type: string
 *               loja:
 *                 type: boolean
 *                 description: Indica se a empresa é loja (local de estoque)
 *               logo:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   url:
 *                     type: string
 *                     description: URL pública do logo da empresa (ex. CDN, storage ou link direto da imagem)
 *     responses:
 *       201:
 *         description: Empresa criada
 */

/**
 * @openapi
 * /empresas/{id}:
 *   put:
 *     summary: Atualiza empresa
 *     tags: [Empresas]
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
 *     responses:
 *       200:
 *         description: Empresa atualizada
 */

/**
 * @openapi
 * /empresas/{id}:
 *   delete:
 *     summary: Remove empresa
 *     tags: [Empresas]
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
 *         description: Empresa removida
 */
