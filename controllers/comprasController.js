import { getPool } from "../db.js";

const TABLE = 'compras';
const TABLE_ITENS = 'compras_itens';

async function gerarNumeroCompra(pool) {
  // Buscar último número
  const [rows] = await pool.query(
    `SELECT numero FROM ${TABLE} 
     WHERE numero LIKE 'COMP-%' 
     ORDER BY CAST(SUBSTRING(numero, 6) AS UNSIGNED) DESC 
     LIMIT 1`
  );

  let proximoNumero = 1;
  if (rows.length > 0) {
    const ultimoNumero = rows[0].numero;
    const match = ultimoNumero.match(/COMP-(\d+)/);
    if (match) {
      proximoNumero = parseInt(match[1], 10) + 1;
    }
  }

  return `COMP-${String(proximoNumero).padStart(4, '0')}`;
}

async function calcularValorTotal(pool, compraId) {
  const [itensRows] = await pool.query(
    `SELECT SUM(valor_total) as total FROM ${TABLE_ITENS} WHERE compra_id = ?`,
    [compraId]
  );
  const totalItens = Number(itensRows[0]?.total || 0);

  const [compraRows] = await pool.query(`SELECT desconto FROM ${TABLE} WHERE id = ?`, [compraId]);
  const desconto = Number(compraRows[0]?.desconto || 0);

  const valorTotal = totalItens - desconto;

  await pool.query(`UPDATE ${TABLE} SET valor_total = ? WHERE id = ?`, [valorTotal, compraId]);
  return valorTotal;
}

async function list(req, res) {
  const pool = getPool();
  const limit = Number(req.query.limit || req.query.perPage || 10);
  const page = Math.max(1, Number(req.query.page || 1));
  const offset = (page - 1) * limit;

  const whereParts = [];
  const params = [];

  // Filtros
  if (req.query.fornecedor_id) {
    whereParts.push('fornecedor_id = ?');
    params.push(Number(req.query.fornecedor_id));
  }

  if (req.query.status) {
    whereParts.push('status = ?');
    params.push(req.query.status);
  }

  if (req.query.data_inicio) {
    whereParts.push('data >= ?');
    params.push(req.query.data_inicio);
  }

  if (req.query.data_fim) {
    whereParts.push('data <= ?');
    params.push(req.query.data_fim);
  }

  // Busca geral (q)
  const q = req.query.q ? String(req.query.q).trim() : "";
  if (q) {
    whereParts.push('(numero LIKE ? OR observacoes LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  // Ordenação
  const sortBy = req.query.sortBy || 'data';
  const sortDir = String(req.query.sortDir || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const dataSql = `
    SELECT c.*
    FROM ${TABLE} c
    ${whereSql}
    ORDER BY c.${sortBy} ${sortDir}
    LIMIT ? OFFSET ?
  `;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM ${TABLE} c
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

  // Buscar compra
  const [compraRows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
  if (compraRows.length === 0) {
    return res.status(404).json({ message: 'Compra não encontrada' });
  }

  const compra = compraRows[0];

  // Buscar itens
  const [itensRows] = await pool.query(
    `SELECT ci.*, p.descricao as produto_descricao
     FROM ${TABLE_ITENS} ci
     LEFT JOIN produtos p ON ci.produto_id = p.id
     WHERE ci.compra_id = ?
     ORDER BY ci.id`,
    [id]
  );

  compra.itens = itensRows;

  res.json(compra);
}

async function create(req, res) {
  const pool = getPool();
  const {
    fornecedor_id,
    data,
    data_entrega,
    desconto,
    observacoes,
    itens,
  } = req.body;

  // Validações
  if (!data) {
    return res.status(400).json({ message: 'data é obrigatória' });
  }
  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ message: 'itens é obrigatório e deve conter pelo menos um item' });
  }

  // Validar itens
  for (const item of itens) {
    if (!item.produto_id) {
      return res.status(400).json({ message: 'produto_id é obrigatório em todos os itens' });
    }
    if (!item.quantidade || Number(item.quantidade) <= 0) {
      return res.status(400).json({ message: 'quantidade deve ser maior que zero' });
    }
    if (!item.valor_unitario || Number(item.valor_unitario) <= 0) {
      return res.status(400).json({ message: 'valor_unitario deve ser maior que zero' });
    }

    // Verificar se produto existe
    const [produtoRows] = await pool.query('SELECT id FROM produtos WHERE id = ?', [item.produto_id]);
    if (produtoRows.length === 0) {
      return res.status(404).json({ message: `Produto ${item.produto_id} não encontrado` });
    }
  }

  const usuario_id = req.user.id;
  const numero = await gerarNumeroCompra(pool);

  await pool.query('START TRANSACTION');

  try {
    // Criar compra
    const [result] = await pool.query(
      `INSERT INTO ${TABLE} 
       (numero, fornecedor_id, data, data_entrega, desconto, observacoes, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [numero, fornecedor_id || null, data, data_entrega || null, Number(desconto || 0), observacoes || null, usuario_id]
    );

    const compraId = result.insertId;

    // Criar itens
    for (const item of itens) {
      const quantidade = Number(item.quantidade);
      const valorUnitario = Number(item.valor_unitario);
      const valorTotal = quantidade * valorUnitario;

      await pool.query(
        `INSERT INTO ${TABLE_ITENS} 
         (compra_id, produto_id, quantidade, valor_unitario, valor_total)
         VALUES (?, ?, ?, ?, ?)`,
        [compraId, item.produto_id, quantidade, valorUnitario, valorTotal]
      );
    }

    // Calcular valor total
    await calcularValorTotal(pool, compraId);

    await pool.query('COMMIT');
    res.status(201).json({ id: compraId });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Erro ao criar compra:', error);
    res.status(500).json({ message: 'Erro ao criar compra', error: error.message });
  }
}

async function update(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);
  const {
    fornecedor_id,
    data,
    data_entrega,
    desconto,
    observacoes,
    itens,
  } = req.body;

  // Verificar se existe
  const [existingRows] = await pool.query(`SELECT id, status FROM ${TABLE} WHERE id = ?`, [id]);
  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Compra não encontrada' });
  }

  // Não permitir editar se finalizada
  if (existingRows[0].status === 'FINALIZADA') {
    return res.status(409).json({ message: 'Compra finalizada não pode ser editada' });
  }

  await pool.query('START TRANSACTION');

  try {
    // Atualizar compra
    const updates = [];
    const params = [];

    if (fornecedor_id !== undefined) {
      updates.push('fornecedor_id = ?');
      params.push(fornecedor_id);
    }
    if (data !== undefined) {
      updates.push('data = ?');
      params.push(data);
    }
    if (data_entrega !== undefined) {
      updates.push('data_entrega = ?');
      params.push(data_entrega);
    }
    if (desconto !== undefined) {
      updates.push('desconto = ?');
      params.push(Number(desconto));
    }
    if (observacoes !== undefined) {
      updates.push('observacoes = ?');
      params.push(observacoes);
    }

    if (updates.length > 0) {
      params.push(id);
      await pool.query(`UPDATE ${TABLE} SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Atualizar itens (se informado)
    if (itens && Array.isArray(itens)) {
      // Deletar itens existentes
      await pool.query(`DELETE FROM ${TABLE_ITENS} WHERE compra_id = ?`, [id]);

      // Criar novos itens
      for (const item of itens) {
        const quantidade = Number(item.quantidade);
        const valorUnitario = Number(item.valor_unitario);
        const valorTotal = quantidade * valorUnitario;

        await pool.query(
          `INSERT INTO ${TABLE_ITENS} 
           (compra_id, produto_id, quantidade, valor_unitario, valor_total)
           VALUES (?, ?, ?, ?, ?)`,
          [id, item.produto_id, quantidade, valorUnitario, valorTotal]
        );
      }

      // Recalcular valor total
      await calcularValorTotal(pool, id);
    }

    await pool.query('COMMIT');
    res.json({ message: 'Atualizado com sucesso' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Erro ao atualizar compra:', error);
    res.status(500).json({ message: 'Erro ao atualizar compra', error: error.message });
  }
}

async function remove(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);

  // Verificar se existe
  const [existingRows] = await pool.query(`SELECT id, status FROM ${TABLE} WHERE id = ?`, [id]);
  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Compra não encontrada' });
  }

  // Bloquear exclusão se finalizada
  if (existingRows[0].status === 'FINALIZADA') {
    return res.status(409).json({ message: 'Compra finalizada não pode ser excluída' });
  }

  await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  res.json({ message: 'Excluído com sucesso' });
}

async function finalizar(req, res) {
  const pool = getPool();
  const id = Number(req.params.id);

  // Verificar se existe
  const [existingRows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
  if (existingRows.length === 0) {
    return res.status(404).json({ message: 'Compra não encontrada' });
  }

  const compra = existingRows[0];

  // Validar status
  if (compra.status === 'FINALIZADA') {
    return res.status(409).json({ message: 'Compra já está finalizada' });
  }
  if (compra.status === 'CANCELADA') {
    return res.status(409).json({ message: 'Compra cancelada não pode ser finalizada' });
  }

  // Buscar itens
  const [itensRows] = await pool.query(`SELECT * FROM ${TABLE_ITENS} WHERE compra_id = ?`, [id]);
  if (itensRows.length === 0) {
    return res.status(400).json({ message: 'Compra não possui itens' });
  }

  await pool.query('START TRANSACTION');

  try {
    // Atualizar status
    await pool.query(`UPDATE ${TABLE} SET status = 'FINALIZADA' WHERE id = ?`, [id]);

    // Criar movimentações de estoque
    for (const item of itensRows) {
      // Verificar se existe registro de estoque
      const [stockRows] = await pool.query(
        'SELECT id FROM stock_balances WHERE product_id = ? AND location_id = 1',
        [item.produto_id]
      );

      let qtyBefore = 0;
      if (stockRows.length === 0) {
        // Criar registro de estoque
        await pool.query(
          'INSERT INTO stock_balances (product_id, location_id, qty_on_hand) VALUES (?, 1, 0)',
          [item.produto_id]
        );
      } else {
        const [qtyRows] = await pool.query(
          'SELECT qty_on_hand FROM stock_balances WHERE product_id = ? AND location_id = 1',
          [item.produto_id]
        );
        qtyBefore = Number(qtyRows[0].qty_on_hand || 0);
      }

      const qtyAfter = qtyBefore + Number(item.quantidade);

      // Atualizar saldo
      await pool.query(
        'UPDATE stock_balances SET qty_on_hand = ? WHERE product_id = ? AND location_id = 1',
        [qtyAfter, item.produto_id]
      );

      // Criar movimentação
      await pool.query(
        `INSERT INTO stock_movements 
         (product_id, location_id, type, qty, qty_before, qty_after, ref_type, ref_id, created_by)
         VALUES (?, 1, 'ENTRY', ?, ?, ?, 'PURCHASE', ?, ?)`,
        [item.produto_id, item.quantidade, qtyBefore, qtyAfter, id, req.user.id]
      );
    }

    // Opcionalmente criar conta a pagar (se fornecedor informado)
    if (compra.fornecedor_id) {
      await pool.query(
        `INSERT INTO contas_pagar 
         (fornecedor_id, descricao, valor, vencimento, compra_id, usuario_id)
         VALUES (?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 30 DAY), ?, ?)`,
        [compra.fornecedor_id, `Compra ${compra.numero}`, compra.valor_total, id, req.user.id]
      );
    }

    await pool.query('COMMIT');
    res.json({ message: 'Compra finalizada com sucesso' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Erro ao finalizar compra:', error);
    res.status(500).json({ message: 'Erro ao finalizar compra', error: error.message });
  }
}

export { list, getById, create, update, remove, finalizar };
