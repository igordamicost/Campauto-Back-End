import { getPool } from "../db.js";

const TABLE = 'contas_pagar';

async function list(req, res) {
  const pool = getPool();
  const limit = Number(req.query.limit || req.query.perPage || 10);
  const page = Math.max(1, Number(req.query.page || 1));
  const offset = (page - 1) * limit;

  const whereParts = [];
  const params = [];

  // Filtros específicos
  if (req.query.fornecedor_id) {
    whereParts.push('fornecedor_id = ?');
    params.push(Number(req.query.fornecedor_id));
  }

  if (req.query.pago !== undefined) {
    whereParts.push('pago = ?');
    params.push(req.query.pago === 'true' || req.query.pago === '1' ? 1 : 0);
  }

  if (req.query.vencimento_inicio) {
    whereParts.push('vencimento >= ?');
    params.push(req.query.vencimento_inicio);
  }

  if (req.query.vencimento_fim) {
    whereParts.push('vencimento <= ?');
    params.push(req.query.vencimento_fim);
  }

  // Busca geral (q)
  const q = req.query.q ? String(req.query.q).trim() : "";
  if (q) {
    whereParts.push('(descricao LIKE ? OR observacoes LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  // Ordenação
  const sortBy = req.query.sortBy || 'vencimento';
  const sortDir = String(req.query.sortDir || 'asc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const dataSql = `
    SELECT cp.*
    FROM ${TABLE} cp
    ${whereSql}
    ORDER BY cp.${sortBy} ${sortDir}
    LIMIT ? OFFSET ?
  `;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM ${TABLE} cp
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

async function getById(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);

  const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);

  if (rows.length === 0) {
    return res.status(404).json({ message: 'Conta a pagar não encontrada' });
  }

  res.json(rows[0]);
}

async function create(req, res) {
  const pool = getPool();
  const {
    fornecedor_id,
    descricao,
    valor,
    vencimento,
    observacoes,
    compra_id,
  } = req.body;

  // Validações
  if (!descricao || !descricao.trim()) {
    return res.status(400).json({ message: 'descricao é obrigatória' });
  }
  if (!valor || Number(valor) <= 0) {
    return res.status(400).json({ message: 'valor deve ser maior que zero' });
  }
  if (!vencimento) {
    return res.status(400).json({ message: 'vencimento é obrigatório' });
  }

  // Verificar se compra existe (se informado)
  if (compra_id) {
    const [compraRows] = await pool.query('SELECT id FROM compras WHERE id = ?', [compra_id]);
    if (compraRows.length === 0) {
      return res.status(404).json({ message: 'Compra não encontrada' });
    }
  }

  const usuario_id = req.user.id;

  const [result] = await pool.query(
    `INSERT INTO ${TABLE} 
     (fornecedor_id, descricao, valor, vencimento, observacoes, compra_id, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [fornecedor_id || null, descricao, Number(valor), vencimento, observacoes || null, compra_id || null, usuario_id]
  );

  res.status(201).json({ id: result.insertId });
}

async function update(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);
  const {
    fornecedor_id,
    descricao,
    valor,
    vencimento,
    observacoes,
    compra_id,
  } = req.body;

  // Verificar se existe
  const [existingRows] = await pool.query(`SELECT id, pago FROM ${TABLE} WHERE id = ?`, [id]);
  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Conta a pagar não encontrada' });
  }

  // Não permitir editar se já foi paga
  if (existingRows[0].pago) {
    return res.status(409).json({ message: 'Conta já foi paga e não pode ser editada' });
  }

  // Validações
  if (valor !== undefined && Number(valor) <= 0) {
    return res.status(400).json({ message: 'valor deve ser maior que zero' });
  }

  const updates = [];
  const params = [];

  if (fornecedor_id !== undefined) {
    updates.push('fornecedor_id = ?');
    params.push(fornecedor_id);
  }
  if (descricao !== undefined) {
    updates.push('descricao = ?');
    params.push(descricao);
  }
  if (valor !== undefined) {
    updates.push('valor = ?');
    params.push(Number(valor));
  }
  if (vencimento !== undefined) {
    updates.push('vencimento = ?');
    params.push(vencimento);
  }
  if (observacoes !== undefined) {
    updates.push('observacoes = ?');
    params.push(observacoes);
  }
  if (compra_id !== undefined) {
    updates.push('compra_id = ?');
    params.push(compra_id || null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'Nenhum campo para atualizar' });
  }

  params.push(id);

  await pool.query(
    `UPDATE ${TABLE} SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  res.json({ message: 'Atualizado com sucesso' });
}

async function remove(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);

  // Verificar se existe
  const [existingRows] = await pool.query(`SELECT id, pago FROM ${TABLE} WHERE id = ?`, [id]);
  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Conta a pagar não encontrada' });
  }

  // Bloquear exclusão se já foi paga
  if (existingRows[0].pago) {
    return res.status(409).json({ message: 'Conta já foi paga e não pode ser excluída' });
  }

  await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  res.json({ message: 'Excluído com sucesso' });
}

async function pagar(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);
  const { forma_pagamento, conta_caixa_id } = req.body;

  // Verificar se existe
  const [existingRows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Conta a pagar não encontrada' });
  }

  const conta = existingRows[0];

  // Verificar se já foi paga
  if (conta.pago) {
    return res.status(409).json({ message: 'Conta já foi paga' });
  }

  // Iniciar transação
  await pool.query('START TRANSACTION');

  try {
    // Atualizar conta como paga
    await pool.query(
      `UPDATE ${TABLE} 
       SET pago = TRUE, 
           data_pagamento = CURDATE(), 
           forma_pagamento = ?
       WHERE id = ?`,
      [forma_pagamento || null, id]
    );

    // Criar movimentação no caixa (se conta_caixa_id informado)
    if (conta_caixa_id) {
      // Verificar se conta de caixa existe
      const [caixaRows] = await pool.query('SELECT id FROM caixa_contas WHERE id = ?', [conta_caixa_id]);
      if (caixaRows.length === 0) {
        throw new Error('Conta de caixa não encontrada');
      }

      await pool.query(
        `INSERT INTO caixa_movimentacoes 
         (conta_caixa_id, tipo, valor, descricao, data, forma_pagamento, referencia_tipo, referencia_id, usuario_id)
         VALUES (?, 'SAIDA', ?, ?, CURDATE(), ?, 'CONTA_PAGAR', ?, ?)`,
        [conta_caixa_id, conta.valor, `Pagamento: ${conta.descricao}`, forma_pagamento || null, id, req.user.id]
      );
    }

    await pool.query('COMMIT');
    res.json({ message: 'Conta marcada como paga' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Erro ao pagar conta:', error);
    res.status(500).json({ message: 'Erro ao processar pagamento', error: error.message });
  }
}

export { list, getById, create, update, remove, pagar };
