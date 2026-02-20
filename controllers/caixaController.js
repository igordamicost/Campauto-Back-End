import { getPool } from "../db.js";
import * as baseService from "../services/baseService.js";

const TABLE = 'caixa_contas';
const TABLE_MOV = 'caixa_movimentacoes';

async function list(req, res) {
  const { data, total } = await baseService.listWithFilters(TABLE, req.query);
  const limit = Number(req.query.limit || req.query.perPage || 10);
  const page = Math.max(1, Number(req.query.page || 1));
  const totalPages = Math.ceil(total / limit) || 1;

  // Calcular saldo atual para cada conta
  const pool = getPool();
  for (const conta of data) {
    const [saldoRows] = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE 0 END), 0) as entradas,
        COALESCE(SUM(CASE WHEN tipo = 'SAIDA' THEN valor ELSE 0 END), 0) as saidas
       FROM ${TABLE_MOV}
       WHERE conta_caixa_id = ?`,
      [conta.id]
    );
    const saldo = Number(conta.saldo_inicial || 0) + Number(saldoRows[0].entradas || 0) - Number(saldoRows[0].saidas || 0);
    conta.saldo_atual = saldo;
  }

  res.json({
    data,
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
    return res.status(404).json({ message: 'Conta não encontrada' });
  }

  const conta = rows[0];

  // Calcular saldo atual
  const [saldoRows] = await pool.query(
    `SELECT 
      COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE 0 END), 0) as entradas,
      COALESCE(SUM(CASE WHEN tipo = 'SAIDA' THEN valor ELSE 0 END), 0) as saidas
     FROM ${TABLE_MOV}
     WHERE conta_caixa_id = ?`,
    [id]
  );
  const saldo = Number(conta.saldo_inicial || 0) + Number(saldoRows[0].entradas || 0) - Number(saldoRows[0].saidas || 0);
  conta.saldo_atual = saldo;

  res.json(conta);
}

async function create(req, res) {
  const pool = getPool();
  const { nome, tipo, banco, agencia, conta, saldo_inicial } = req.body;

  // Validações
  if (!nome || !nome.trim()) {
    return res.status(400).json({ message: 'nome é obrigatório' });
  }
  if (!tipo || !['CAIXA', 'BANCO'].includes(tipo)) {
    return res.status(400).json({ message: 'tipo deve ser CAIXA ou BANCO' });
  }
  if (tipo === 'BANCO') {
    if (!banco || !banco.trim()) {
      return res.status(400).json({ message: 'banco é obrigatório quando tipo=BANCO' });
    }
    if (!agencia || !agencia.trim()) {
      return res.status(400).json({ message: 'agencia é obrigatória quando tipo=BANCO' });
    }
    if (!conta || !conta.trim()) {
      return res.status(400).json({ message: 'conta é obrigatória quando tipo=BANCO' });
    }
  }

  // Verificar se nome já existe
  const [existingRows] = await pool.query(`SELECT id FROM ${TABLE} WHERE nome = ?`, [nome]);
  if (existingRows.length > 0) {
    return res.status(409).json({ message: 'Já existe uma conta com este nome' });
  }

  const [result] = await pool.query(
    `INSERT INTO ${TABLE} (nome, tipo, banco, agencia, conta, saldo_inicial)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nome, tipo, banco || null, agencia || null, conta || null, Number(saldo_inicial || 0)]
  );

  res.status(201).json({ id: result.insertId });
}

async function update(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);
  const { nome, tipo, banco, agencia, conta, saldo_inicial, ativo } = req.body;

  // Verificar se existe
  const [existingRows] = await pool.query(`SELECT id FROM ${TABLE} WHERE id = ?`, [id]);
  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Conta não encontrada' });
  }

  // Verificar se nome já existe (se mudou)
  if (nome) {
    const [nomeRows] = await pool.query(`SELECT id FROM ${TABLE} WHERE nome = ? AND id != ?`, [nome, id]);
    if (nomeRows.length > 0) {
      return res.status(409).json({ message: 'Já existe uma conta com este nome' });
    }
  }

  const updates = [];
  const params = [];

  if (nome !== undefined) {
    updates.push('nome = ?');
    params.push(nome);
  }
  if (tipo !== undefined) {
    updates.push('tipo = ?');
    params.push(tipo);
  }
  if (banco !== undefined) {
    updates.push('banco = ?');
    params.push(banco);
  }
  if (agencia !== undefined) {
    updates.push('agencia = ?');
    params.push(agencia);
  }
  if (conta !== undefined) {
    updates.push('conta = ?');
    params.push(conta);
  }
  if (saldo_inicial !== undefined) {
    updates.push('saldo_inicial = ?');
    params.push(Number(saldo_inicial));
  }
  if (ativo !== undefined) {
    updates.push('ativo = ?');
    params.push(ativo ? 1 : 0);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'Nenhum campo para atualizar' });
  }

  params.push(id);
  await pool.query(`UPDATE ${TABLE} SET ${updates.join(', ')} WHERE id = ?`, params);

  res.json({ message: 'Atualizado com sucesso' });
}

async function remove(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);

  // Verificar se existe
  const [existingRows] = await pool.query(`SELECT id FROM ${TABLE} WHERE id = ?`, [id]);
  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Conta não encontrada' });
  }

  // Verificar se há movimentações
  const [movRows] = await pool.query(`SELECT COUNT(*) AS total FROM ${TABLE_MOV} WHERE conta_caixa_id = ?`, [id]);
  if (movRows[0].total > 0) {
    return res.status(409).json({ 
      message: 'Conta não pode ser excluída pois possui movimentações vinculadas',
      total_movimentacoes: movRows[0].total
    });
  }

  await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  res.json({ message: 'Excluído com sucesso' });
}

async function getExtrato(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);
  const { data_inicio, data_fim } = req.query;

  // Verificar se conta existe
  const [contaRows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
  if (contaRows.length === 0) {
    return res.status(404).json({ message: 'Conta não encontrada' });
  }

  const conta = contaRows[0];

  // Construir query de movimentações
  const whereParts = ['conta_caixa_id = ?'];
  const params = [id];

  if (data_inicio) {
    whereParts.push('data >= ?');
    params.push(data_inicio);
  }
  if (data_fim) {
    whereParts.push('data <= ?');
    params.push(data_fim);
  }

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;

  // Buscar movimentações
  const [movRows] = await pool.query(
    `SELECT * FROM ${TABLE_MOV} ${whereSql} ORDER BY data DESC, created_at DESC`,
    params
  );

  // Calcular saldo inicial do período
  let saldoInicial = Number(conta.saldo_inicial || 0);
  if (data_inicio) {
    const [saldoAntesRows] = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE 0 END), 0) as entradas,
        COALESCE(SUM(CASE WHEN tipo = 'SAIDA' THEN valor ELSE 0 END), 0) as saidas
       FROM ${TABLE_MOV}
       WHERE conta_caixa_id = ? AND data < ?`,
      [id, data_inicio]
    );
    saldoInicial += Number(saldoAntesRows[0].entradas || 0) - Number(saldoAntesRows[0].saidas || 0);
  }

  // Calcular saldo final
  let saldoFinal = saldoInicial;
  for (const mov of movRows) {
    if (mov.tipo === 'ENTRADA') {
      saldoFinal += Number(mov.valor);
    } else {
      saldoFinal -= Number(mov.valor);
    }
  }

  res.json({
    conta: {
      id: conta.id,
      nome: conta.nome,
      tipo: conta.tipo,
    },
    periodo: {
      data_inicio: data_inicio || null,
      data_fim: data_fim || null,
    },
    saldo_inicial: saldoInicial,
    saldo_final: saldoFinal,
    movimentacoes: movRows,
  });
}

async function getSaldos(req, res) {
  const pool = getPool();

  // Buscar todas as contas ativas
  const [contasRows] = await pool.query(`SELECT * FROM ${TABLE} WHERE ativo = TRUE`);

  let totalCaixa = 0;
  let totalBanco = 0;
  const contas = [];

  for (const conta of contasRows) {
    const [saldoRows] = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE 0 END), 0) as entradas,
        COALESCE(SUM(CASE WHEN tipo = 'SAIDA' THEN valor ELSE 0 END), 0) as saidas
       FROM ${TABLE_MOV}
       WHERE conta_caixa_id = ?`,
      [conta.id]
    );
    const saldoAtual = Number(conta.saldo_inicial || 0) + Number(saldoRows[0].entradas || 0) - Number(saldoRows[0].saidas || 0);

    if (conta.tipo === 'CAIXA') {
      totalCaixa += saldoAtual;
    } else {
      totalBanco += saldoAtual;
    }

    contas.push({
      id: conta.id,
      nome: conta.nome,
      tipo: conta.tipo,
      saldo_atual: saldoAtual,
    });
  }

  res.json({
    total_caixa: totalCaixa,
    total_banco: totalBanco,
    total_geral: totalCaixa + totalBanco,
    contas,
  });
}

async function createMovimentacao(req, res) {
  const pool = getPool();
  const {
    conta_caixa_id,
    tipo,
    valor,
    descricao,
    data,
    forma_pagamento,
    observacoes,
  } = req.body;

  // Validações
  if (!conta_caixa_id) {
    return res.status(400).json({ message: 'conta_caixa_id é obrigatório' });
  }
  if (!tipo || !['ENTRADA', 'SAIDA'].includes(tipo)) {
    return res.status(400).json({ message: 'tipo deve ser ENTRADA ou SAIDA' });
  }
  if (!valor || Number(valor) <= 0) {
    return res.status(400).json({ message: 'valor deve ser maior que zero' });
  }
  if (!descricao || !descricao.trim()) {
    return res.status(400).json({ message: 'descricao é obrigatória' });
  }
  if (!data) {
    return res.status(400).json({ message: 'data é obrigatória' });
  }

  // Verificar se conta existe
  const [contaRows] = await pool.query(`SELECT id FROM ${TABLE} WHERE id = ?`, [conta_caixa_id]);
  if (contaRows.length === 0) {
    return res.status(404).json({ message: 'Conta não encontrada' });
  }

  const usuario_id = req.user.id;

  const [result] = await pool.query(
    `INSERT INTO ${TABLE_MOV} 
     (conta_caixa_id, tipo, valor, descricao, data, forma_pagamento, observacoes, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [conta_caixa_id, tipo, Number(valor), descricao, data, forma_pagamento || null, observacoes || null, usuario_id]
  );

  res.status(201).json({ id: result.insertId });
}

export { list, getById, create, update, remove, getExtrato, getSaldos, createMovimentacao };
