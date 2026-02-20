import { getPool } from "../db.js";

const TABLE_OS = 'oficina_os';
const TABLE_CHECKLIST = 'os_checklists';

async function gerarNumeroOS(pool) {
  // Buscar último número
  const [rows] = await pool.query(
    `SELECT numero FROM ${TABLE_OS} 
     WHERE numero LIKE 'OS-%' 
     ORDER BY CAST(SUBSTRING(numero, 4) AS UNSIGNED) DESC 
     LIMIT 1`
  );

  let proximoNumero = 1;
  if (rows.length > 0) {
    const ultimoNumero = rows[0].numero;
    const match = ultimoNumero.match(/OS-(\d+)/);
    if (match) {
      proximoNumero = parseInt(match[1], 10) + 1;
    }
  }

  return `OS-${String(proximoNumero).padStart(4, '0')}`;
}

async function calcularValorTotal(pool, osId) {
  const [osRows] = await pool.query(
    `SELECT valor_servicos, valor_pecas FROM ${TABLE_OS} WHERE id = ?`,
    [osId]
  );
  if (osRows.length === 0) return;

  const valorTotal = Number(osRows[0].valor_servicos || 0) + Number(osRows[0].valor_pecas || 0);
  await pool.query(`UPDATE ${TABLE_OS} SET valor_total = ? WHERE id = ?`, [valorTotal, osId]);
}

async function listOS(req, res) {
  const pool = getPool();
  const limit = Number(req.query.limit || req.query.perPage || 20);
  const page = Math.max(1, Number(req.query.page || 1));
  const offset = (page - 1) * limit;

  const whereParts = [];
  const params = [];

  // Filtros
  if (req.query.cliente_id) {
    whereParts.push('cliente_id = ?');
    params.push(Number(req.query.cliente_id));
  }

  if (req.query.veiculo_id) {
    whereParts.push('veiculo_id = ?');
    params.push(Number(req.query.veiculo_id));
  }

  if (req.query.status) {
    whereParts.push('status = ?');
    params.push(req.query.status);
  }

  if (req.query.usuario_id) {
    whereParts.push('usuario_id = ?');
    params.push(Number(req.query.usuario_id));
  }

  // Busca geral (q)
  const q = req.query.q ? String(req.query.q).trim() : "";
  if (q) {
    whereParts.push('(numero LIKE ? OR observacoes LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  // Include relacionamentos
  const includeClientes = req.query.include?.includes('clientes') || req.query.include?.includes('cliente');
  const includeVeiculos = req.query.include?.includes('veiculos') || req.query.include?.includes('veiculo');

  let selectFields = 'os.*';
  let joinSql = '';
  if (includeClientes || includeVeiculos) {
    if (includeClientes) {
      selectFields += ', c.fantasia as cliente_nome, c.razao_social as cliente_razao';
      joinSql += 'LEFT JOIN clientes c ON os.cliente_id = c.id ';
    }
    if (includeVeiculos) {
      selectFields += ', v.marca as veiculo_marca, v.modelo as veiculo_modelo, v.placa as veiculo_placa';
      joinSql += 'LEFT JOIN veiculos v ON os.veiculo_id = v.id ';
    }
  }

  // Ordenação
  const sortBy = req.query.sortBy || 'data_abertura';
  const sortDir = String(req.query.sortDir || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const dataSql = `
    SELECT ${selectFields}
    FROM ${TABLE_OS} os
    ${joinSql}
    ${whereSql}
    ORDER BY os.${sortBy} ${sortDir}
    LIMIT ? OFFSET ?
  `;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM ${TABLE_OS} os
    ${joinSql}
    ${whereSql}
  `;

  const [rows] = await pool.query(dataSql, [...params, limit, offset]);
  const [[countRow]] = await pool.query(countSql, params);
  const total = Number(countRow.total);
  const totalPages = Math.ceil(total / limit) || 1;

  res.json({
    data: rows,
    page,
    perPage: limit,
    total,
    totalPages,
  });
}

async function getOSById(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);

  const [rows] = await pool.query(
    `SELECT os.*, 
            c.fantasia as cliente_nome, 
            c.razao_social as cliente_razao,
            v.marca as veiculo_marca, 
            v.modelo as veiculo_modelo, 
            v.placa as veiculo_placa
     FROM ${TABLE_OS} os
     LEFT JOIN clientes c ON os.cliente_id = c.id
     LEFT JOIN veiculos v ON os.veiculo_id = v.id
     WHERE os.id = ?`,
    [id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: 'Ordem de serviço não encontrada' });
  }

  res.json(rows[0]);
}

async function createOS(req, res) {
  const pool = getPool();
  const {
    cliente_id,
    veiculo_id,
    data_previsao,
    km_entrada,
    observacoes,
    orcamento_servico_id,
    valor_servicos,
    valor_pecas,
  } = req.body;

  // Validações
  if (!cliente_id) {
    return res.status(400).json({ message: 'cliente_id é obrigatório' });
  }
  if (!veiculo_id) {
    return res.status(400).json({ message: 'veiculo_id é obrigatório' });
  }

  // Verificar se cliente existe
  const [clienteRows] = await pool.query('SELECT id FROM clientes WHERE id = ?', [cliente_id]);
  if (clienteRows.length === 0) {
    return res.status(404).json({ message: 'Cliente não encontrado' });
  }

  // Verificar se veículo existe
  const [veiculoRows] = await pool.query('SELECT id FROM veiculos WHERE id = ?', [veiculo_id]);
  if (veiculoRows.length === 0) {
    return res.status(404).json({ message: 'Veículo não encontrado' });
  }

  // Verificar se orçamento existe (se informado)
  if (orcamento_servico_id) {
    const [orcamentoRows] = await pool.query('SELECT id FROM orcamentos_servico WHERE id = ?', [orcamento_servico_id]);
    if (orcamentoRows.length === 0) {
      return res.status(404).json({ message: 'Orçamento de serviço não encontrado' });
    }
  }

  const usuario_id = req.user.id;
  const numero = await gerarNumeroOS(pool);
  const dataAbertura = new Date().toISOString().split('T')[0];

  const [result] = await pool.query(
    `INSERT INTO ${TABLE_OS} 
     (numero, cliente_id, veiculo_id, data_abertura, data_previsao, km_entrada, 
      valor_servicos, valor_pecas, observacoes, usuario_id, orcamento_servico_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      numero,
      cliente_id,
      veiculo_id,
      dataAbertura,
      data_previsao || null,
      km_entrada || null,
      Number(valor_servicos || 0),
      Number(valor_pecas || 0),
      observacoes || null,
      usuario_id,
      orcamento_servico_id || null,
    ]
  );

  await calcularValorTotal(pool, result.insertId);

  res.status(201).json({ id: result.insertId });
}

async function updateOS(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);
  const {
    cliente_id,
    veiculo_id,
    data_previsao,
    km_entrada,
    km_saida,
    observacoes,
    valor_servicos,
    valor_pecas,
  } = req.body;

  // Verificar se existe
  const [existingRows] = await pool.query(`SELECT id, status FROM ${TABLE_OS} WHERE id = ?`, [id]);
  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Ordem de serviço não encontrada' });
  }

  // Não permitir editar se finalizada
  if (existingRows[0].status === 'FINALIZADA') {
    return res.status(409).json({ message: 'OS finalizada não pode ser editada' });
  }

  const updates = [];
  const params = [];

  if (cliente_id !== undefined) {
    updates.push('cliente_id = ?');
    params.push(cliente_id);
  }
  if (veiculo_id !== undefined) {
    updates.push('veiculo_id = ?');
    params.push(veiculo_id);
  }
  if (data_previsao !== undefined) {
    updates.push('data_previsao = ?');
    params.push(data_previsao);
  }
  if (km_entrada !== undefined) {
    updates.push('km_entrada = ?');
    params.push(km_entrada);
  }
  if (km_saida !== undefined) {
    updates.push('km_saida = ?');
    params.push(km_saida);
  }
  if (observacoes !== undefined) {
    updates.push('observacoes = ?');
    params.push(observacoes);
  }
  if (valor_servicos !== undefined) {
    updates.push('valor_servicos = ?');
    params.push(Number(valor_servicos));
  }
  if (valor_pecas !== undefined) {
    updates.push('valor_pecas = ?');
    params.push(Number(valor_pecas));
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'Nenhum campo para atualizar' });
  }

  params.push(id);
  await pool.query(`UPDATE ${TABLE_OS} SET ${updates.join(', ')} WHERE id = ?`, params);

  await calcularValorTotal(pool, id);

  res.json({ message: 'Atualizado com sucesso' });
}

async function removeOS(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);

  // Verificar se existe
  const [existingRows] = await pool.query(`SELECT id, status FROM ${TABLE_OS} WHERE id = ?`, [id]);
  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Ordem de serviço não encontrada' });
  }

  // Bloquear exclusão se finalizada
  if (existingRows[0].status === 'FINALIZADA') {
    return res.status(409).json({ message: 'OS finalizada não pode ser excluída' });
  }

  await pool.query(`DELETE FROM ${TABLE_OS} WHERE id = ?`, [id]);
  res.json({ message: 'Excluído com sucesso' });
}

async function updateStatus(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);
  const { status, motivo } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'status é obrigatório' });
  }

  const statusValidos = ['ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_PECAS', 'FINALIZADA', 'CANCELADA'];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ message: `status deve ser um dos: ${statusValidos.join(', ')}` });
  }

  // Verificar se existe
  const [existingRows] = await pool.query(`SELECT * FROM ${TABLE_OS} WHERE id = ?`, [id]);
  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Ordem de serviço não encontrada' });
  }

  const os = existingRows[0];

  // Validações de transição de status
  if (os.status === 'FINALIZADA' && status !== 'FINALIZADA') {
    return res.status(409).json({ message: 'OS finalizada não pode ter status alterado' });
  }

  if (status === 'CANCELADA' && !motivo) {
    return res.status(400).json({ message: 'motivo é obrigatório ao cancelar' });
  }

  // Atualizar status
  const updates = ['status = ?'];
  const params = [status];

  if (status === 'FINALIZADA' && !os.data_fechamento) {
    updates.push('data_fechamento = CURDATE()');
  }

  if (status === 'CANCELADA' && motivo) {
    if (!os.observacoes) {
      updates.push('observacoes = ?');
      params.push(`Cancelada: ${motivo}`);
    } else {
      updates.push('observacoes = CONCAT(observacoes, ?)');
      params.push(`\n\nCancelada: ${motivo}`);
    }
  }

  params.push(id);
  await pool.query(`UPDATE ${TABLE_OS} SET ${updates.join(', ')} WHERE id = ?`, params);

  res.json({ message: 'Status atualizado com sucesso' });
}

async function finalizarOS(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);
  const { criar_conta_receber, conta_caixa_id } = req.body;

  // Verificar se existe
  const [existingRows] = await pool.query(`SELECT * FROM ${TABLE_OS} WHERE id = ?`, [id]);
  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Ordem de serviço não encontrada' });
  }

  const os = existingRows[0];

  // Validar status
  if (os.status === 'FINALIZADA') {
    return res.status(409).json({ message: 'OS já está finalizada' });
  }
  if (os.status === 'CANCELADA') {
    return res.status(409).json({ message: 'OS cancelada não pode ser finalizada' });
  }

  await pool.query('START TRANSACTION');

  try {
    // Atualizar status
    await pool.query(
      `UPDATE ${TABLE_OS} 
       SET status = 'FINALIZADA', data_fechamento = CURDATE() 
       WHERE id = ?`,
      [id]
    );

    // Opcionalmente criar conta a receber
    if (criar_conta_receber && os.valor_total > 0) {
      await pool.query(
        `INSERT INTO contas_receber 
         (cliente_id, descricao, valor, vencimento, usuario_id)
         VALUES (?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 30 DAY), ?)`,
        [os.cliente_id, `OS ${os.numero}`, os.valor_total, req.user.id]
      );
    }

    await pool.query('COMMIT');
    res.json({ message: 'OS finalizada com sucesso' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Erro ao finalizar OS:', error);
    res.status(500).json({ message: 'Erro ao finalizar OS', error: error.message });
  }
}

async function getChecklists(req, res) {
  const pool = getPool();
  const osId = Number(req.params.osId);

  // Verificar se OS existe
  const [osRows] = await pool.query(`SELECT id FROM ${TABLE_OS} WHERE id = ?`, [osId]);
  if (osRows.length === 0) {
    return res.status(404).json({ message: 'Ordem de serviço não encontrada' });
  }

  const [rows] = await pool.query(
    `SELECT c.*, u.name as responsavel_nome
     FROM ${TABLE_CHECKLIST} c
     LEFT JOIN users u ON c.responsavel_id = u.id
     WHERE c.os_id = ?
     ORDER BY c.ordem ASC, c.id ASC`,
    [osId]
  );

  res.json({ data: rows });
}

async function createChecklist(req, res) {
  const pool = getPool();
  const osId = Number(req.params.osId);
  const { item_nome, descricao, ordem } = req.body;

  // Verificar se OS existe
  const [osRows] = await pool.query(`SELECT id, status FROM ${TABLE_OS} WHERE id = ?`, [osId]);
  if (osRows.length === 0) {
    return res.status(404).json({ message: 'Ordem de serviço não encontrada' });
  }

  // Não permitir adicionar checklist se OS finalizada
  if (osRows[0].status === 'FINALIZADA') {
    return res.status(409).json({ message: 'Não é possível adicionar checklist em OS finalizada' });
  }

  if (!item_nome || !item_nome.trim()) {
    return res.status(400).json({ message: 'item_nome é obrigatório' });
  }

  // Determinar ordem (última + 1 se não informado)
  let ordemFinal = ordem;
  if (!ordemFinal) {
    const [ordemRows] = await pool.query(
      `SELECT MAX(ordem) as max_ordem FROM ${TABLE_CHECKLIST} WHERE os_id = ?`,
      [osId]
    );
    ordemFinal = (ordemRows[0]?.max_ordem || 0) + 1;
  }

  const [result] = await pool.query(
    `INSERT INTO ${TABLE_CHECKLIST} (os_id, item_nome, descricao, ordem)
     VALUES (?, ?, ?, ?)`,
    [osId, item_nome, descricao || null, ordemFinal]
  );

  res.status(201).json({ id: result.insertId });
}

async function updateChecklist(req, res) {
  const pool = getPool();
  const osId = Number(req.params.osId);
  const checklistId = Number(req.params.checklistId);
  const { item_nome, descricao, ordem, observacoes } = req.body;

  // Verificar se existe
  const [existingRows] = await pool.query(
    `SELECT c.*, os.status 
     FROM ${TABLE_CHECKLIST} c
     JOIN ${TABLE_OS} os ON c.os_id = os.id
     WHERE c.id = ? AND c.os_id = ?`,
    [checklistId, osId]
  );

  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Checklist não encontrado' });
  }

  // Não permitir editar se OS finalizada
  if (existingRows[0].status === 'FINALIZADA') {
    return res.status(409).json({ message: 'Não é possível editar checklist de OS finalizada' });
  }

  const updates = [];
  const params = [];

  if (item_nome !== undefined) {
    updates.push('item_nome = ?');
    params.push(item_nome);
  }
  if (descricao !== undefined) {
    updates.push('descricao = ?');
    params.push(descricao);
  }
  if (ordem !== undefined) {
    updates.push('ordem = ?');
    params.push(ordem);
  }
  if (observacoes !== undefined) {
    updates.push('observacoes = ?');
    params.push(observacoes);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'Nenhum campo para atualizar' });
  }

  params.push(checklistId, osId);
  await pool.query(
    `UPDATE ${TABLE_CHECKLIST} SET ${updates.join(', ')} WHERE id = ? AND os_id = ?`,
    params
  );

  res.json({ message: 'Atualizado com sucesso' });
}

async function removeChecklist(req, res) {
  const pool = getPool();
  const osId = Number(req.params.osId);
  const checklistId = Number(req.params.checklistId);

  // Verificar se existe e se OS não está finalizada
  const [existingRows] = await pool.query(
    `SELECT c.*, os.status 
     FROM ${TABLE_CHECKLIST} c
     JOIN ${TABLE_OS} os ON c.os_id = os.id
     WHERE c.id = ? AND c.os_id = ?`,
    [checklistId, osId]
  );

  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Checklist não encontrado' });
  }

  if (existingRows[0].status === 'FINALIZADA') {
    return res.status(409).json({ message: 'Não é possível excluir checklist de OS finalizada' });
  }

  await pool.query(`DELETE FROM ${TABLE_CHECKLIST} WHERE id = ? AND os_id = ?`, [checklistId, osId]);
  res.json({ message: 'Excluído com sucesso' });
}

async function concluirChecklist(req, res) {
  const pool = getPool();
  const osId = Number(req.params.osId);
  const checklistId = Number(req.params.checklistId);
  const { observacoes } = req.body;

  // Verificar se existe
  const [existingRows] = await pool.query(
    `SELECT c.*, os.status 
     FROM ${TABLE_CHECKLIST} c
     JOIN ${TABLE_OS} os ON c.os_id = os.id
     WHERE c.id = ? AND c.os_id = ?`,
    [checklistId, osId]
  );

  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Checklist não encontrado' });
  }

  const checklist = existingRows[0];

  if (checklist.concluido) {
    return res.status(409).json({ message: 'Checklist já está concluído' });
  }

  const usuario_id = req.user.id;

  await pool.query(
    `UPDATE ${TABLE_CHECKLIST} 
     SET concluido = TRUE, 
         data_conclusao = NOW(), 
         responsavel_id = ?,
         observacoes = COALESCE(?, observacoes)
     WHERE id = ? AND os_id = ?`,
    [usuario_id, observacoes || null, checklistId, osId]
  );

  res.json({ message: 'Checklist concluído com sucesso' });
}

export {
  listOS,
  getOSById,
  createOS,
  updateOS,
  removeOS,
  updateStatus,
  finalizarOS,
  getChecklists,
  createChecklist,
  updateChecklist,
  removeChecklist,
  concluirChecklist,
};
