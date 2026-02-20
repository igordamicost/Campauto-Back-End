/**
 * @openapi
 * /oficina/os:
 *   get:
 *     summary: Lista ordens de serviço
 *     tags: [Oficina]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: cliente_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: veiculo_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ABERTA, EM_ANDAMENTO, AGUARDANDO_PECAS, FINALIZADA, CANCELADA]
 *       - in: query
 *         name: usuario_id
 *         schema:
 *           type: integer
 *         description: Filtrar por mecânico responsável
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: include
 *         schema:
 *           type: string
 *         description: Relacionamentos (clientes, veiculos)
 *     responses:
 *       200:
 *         description: Lista de OS paginada
 */

/**
 * @openapi
 * /oficina/os/{id}:
 *   get:
 *     summary: Busca ordem de serviço por ID
 *     tags: [Oficina]
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
 *         description: OS encontrada
 *       404:
 *         description: OS não encontrada
 */

/**
 * @openapi
 * /oficina/os:
 *   post:
 *     summary: Cria ordem de serviço
 *     tags: [Oficina]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cliente_id, veiculo_id]
 *             properties:
 *               cliente_id:
 *                 type: integer
 *               veiculo_id:
 *                 type: integer
 *               data_previsao:
 *                 type: string
 *                 format: date
 *               km_entrada:
 *                 type: integer
 *               observacoes:
 *                 type: string
 *               orcamento_servico_id:
 *                 type: integer
 *               valor_servicos:
 *                 type: number
 *                 default: 0
 *               valor_pecas:
 *                 type: number
 *                 default: 0
 *     responses:
 *       201:
 *         description: OS criada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 */

/**
 * @openapi
 * /oficina/os/{id}:
 *   put:
 *     summary: Atualiza ordem de serviço
 *     tags: [Oficina]
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
 *             properties:
 *               cliente_id:
 *                 type: integer
 *               veiculo_id:
 *                 type: integer
 *               data_previsao:
 *                 type: string
 *                 format: date
 *               km_entrada:
 *                 type: integer
 *               km_saida:
 *                 type: integer
 *               valor_servicos:
 *                 type: number
 *               valor_pecas:
 *                 type: number
 *               observacoes:
 *                 type: string
 *     responses:
 *       200:
 *         description: OS atualizada
 *       409:
 *         description: OS finalizada não pode ser editada
 */

/**
 * @openapi
 * /oficina/os/{id}:
 *   delete:
 *     summary: Remove ordem de serviço
 *     tags: [Oficina]
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
 *         description: OS excluída
 *       409:
 *         description: OS finalizada não pode ser excluída
 */

/**
 * @openapi
 * /oficina/os/{id}/status:
 *   patch:
 *     summary: Atualiza status da ordem de serviço
 *     tags: [Oficina]
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ABERTA, EM_ANDAMENTO, AGUARDANDO_PECAS, FINALIZADA, CANCELADA]
 *               motivo:
 *                 type: string
 *                 description: Obrigatório quando status=CANCELADA
 *     responses:
 *       200:
 *         description: Status atualizado
 *       400:
 *         description: Transição de status inválida ou motivo faltando
 *       409:
 *         description: OS finalizada não pode ter status alterado
 */

/**
 * @openapi
 * /oficina/os/{id}/finalizar:
 *   post:
 *     summary: Finaliza ordem de serviço
 *     tags: [Oficina]
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
 *               criar_conta_receber:
 *                 type: boolean
 *                 default: false
 *                 description: Se true, cria conta a receber automaticamente
 *               conta_caixa_id:
 *                 type: integer
 *     description: |
 *       Finaliza a OS alterando status para FINALIZADA e:
 *       - Define data_fechamento como data atual
 *       - Opcionalmente cria conta a receber se criar_conta_receber=true
 *     responses:
 *       200:
 *         description: OS finalizada com sucesso
 *       409:
 *         description: OS já está finalizada ou cancelada
 */

/**
 * @openapi
 * /oficina/os/{osId}/checklists:
 *   get:
 *     summary: Lista checklists da OS
 *     tags: [Oficina]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: osId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de checklists
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
 *                       os_id:
 *                         type: integer
 *                       item_nome:
 *                         type: string
 *                       descricao:
 *                         type: string
 *                       concluido:
 *                         type: boolean
 *                       data_conclusao:
 *                         type: string
 *                         format: date-time
 *                       responsavel_id:
 *                         type: integer
 *                       responsavel_nome:
 *                         type: string
 *                       observacoes:
 *                         type: string
 *                       ordem:
 *                         type: integer
 */

/**
 * @openapi
 * /oficina/os/{osId}/checklists:
 *   post:
 *     summary: Cria item de checklist
 *     tags: [Oficina]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: osId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [item_nome]
 *             properties:
 *               item_nome:
 *                 type: string
 *               descricao:
 *                 type: string
 *               ordem:
 *                 type: integer
 *                 description: Se não informado, será o último + 1
 *     responses:
 *       201:
 *         description: Checklist criado
 *       409:
 *         description: Não é possível adicionar checklist em OS finalizada
 */

/**
 * @openapi
 * /oficina/os/{osId}/checklists/{checklistId}:
 *   put:
 *     summary: Atualiza item de checklist
 *     tags: [Oficina]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: osId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: checklistId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               item_nome:
 *                 type: string
 *               descricao:
 *                 type: string
 *               ordem:
 *                 type: integer
 *               observacoes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Checklist atualizado
 *       409:
 *         description: Não é possível editar checklist de OS finalizada
 */

/**
 * @openapi
 * /oficina/os/{osId}/checklists/{checklistId}:
 *   delete:
 *     summary: Remove item de checklist
 *     tags: [Oficina]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: osId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: checklistId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Checklist excluído
 *       409:
 *         description: Não é possível excluir checklist de OS finalizada
 */

/**
 * @openapi
 * /oficina/os/{osId}/checklists/{checklistId}/concluir:
 *   patch:
 *     summary: Marca item de checklist como concluído
 *     tags: [Oficina]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: osId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: checklistId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               observacoes:
 *                 type: string
 *     description: |
 *       Marca o checklist como concluído:
 *       - Define concluido = true
 *       - Define data_conclusao = agora
 *       - Define responsavel_id = usuário logado
 *     responses:
 *       200:
 *         description: Checklist concluído
 *       409:
 *         description: Checklist já está concluído
 */
