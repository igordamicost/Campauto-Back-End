import { getPool } from "../db.js";

const TABLE_OS = "oficina_os";
const TABLE_CHECKLIST = "os_checklists";

function parseJson(value) {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

function toServicosFromJson(json_itens_servico_raw) {
  const arr = parseJson(json_itens_servico_raw) || [];
  if (!Array.isArray(arr) || arr.length === 0) return [];

  const hasNested = arr.some((s) => Array.isArray(s?.itens));

  if (hasNested) {
    // Novo formato: uma linha por serviço
    return arr.map((s) => ({
      servico_id: s.servico_id,
      servico_nome: s.servico_nome,
      valor_unitario: Number(s.valor_unitario || 0),
      itens: Array.isArray(s.itens)
        ? s.itens.map((it) => ({
            item_id: it.item_id,
            descricao: it.descricao,
            concluido: !!it.concluido,
          }))
        : [],
    }));
  }

  // Formato antigo \"flat\": uma linha por subitem com valor próprio
  const mapServicos = new Map();

  for (const it of arr) {
    if (!it) continue;
    const servicoId = it.servico_id != null ? Number(it.servico_id) : null;
    if (servicoId == null || Number.isNaN(servicoId)) continue;
    const key = servicoId;
    const atual =
      mapServicos.get(key) || {
        servico_id: servicoId,
        servico_nome: it.servico_nome,
        valor_unitario: 0,
        itens: [],
      };
    const valor = it.valor_unitario != null ? Number(it.valor_unitario) : 0;
    atual.valor_unitario += valor;
    if (it.item_id != null || it.descricao != null) {
      atual.itens.push({
        item_id: it.item_id,
        descricao: it.descricao,
        concluido: !!it.concluido,
      });
    }
    mapServicos.set(key, atual);
  }

  return Array.from(mapServicos.values());
}

function buildOrcamentoResumo(row) {
  const servicos = toServicosFromJson(row.json_itens_servico);
  const veiculos =
    row.veiculo_id != null
      ? {
          placa: row.veiculo_placa || null,
          marca: row.veiculo_marca || null,
          modelo: row.veiculo_modelo || null,
        }
      : null;

  return {
    id: row.id,
    numero_sequencial: row.numero_sequencial,
    status: row.status,
    elevador_id: row.elevador_id ?? null,
    veiculos,
    json_itens_servico: servicos,
  };
}

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

// ---------- PÁTIO (Kanban) ----------

async function listPatio(req, res) {
  const pool = getPool();

  const [rows] = await pool.query(
    `
      SELECT
        o.id,
        o.numero_sequencial,
        o.status,
        o.elevador_id,
        o.veiculo_id,
        o.json_itens_servico,
        v.marca AS veiculo_marca,
        v.modelo AS veiculo_modelo,
        v.placa AS veiculo_placa
      FROM orcamentos o
      LEFT JOIN veiculos v ON o.veiculo_id = v.id
      WHERE o.status IN ('Aprovado', 'Separado', 'Oficina', 'Faturado')
    `
  );

  const fila = [];
  const elevadores = {};
  const finalizado = [];

  for (const row of rows) {
    const resumo = buildOrcamentoResumo(row);
    if (resumo.status === "Faturado") {
      finalizado.push(resumo);
    } else if (resumo.status === "Oficina" && resumo.elevador_id != null) {
      const key = String(resumo.elevador_id);
      if (!elevadores[key]) elevadores[key] = [];
      elevadores[key].push(resumo);
    } else if (resumo.status === "Aprovado" || resumo.status === "Separado") {
      fila.push(resumo);
    }
  }

  res.json({ fila, elevadores, finalizado });
}

async function movePatio(req, res) {
  const pool = getPool();
  const orcamentoId = Number(req.params.orcamentoId);
  if (!orcamentoId || Number.isNaN(orcamentoId)) {
    return res.status(400).json({ message: "orcamentoId inválido" });
  }

  const { elevador_id } = req.body || {};

  const [orcRows] = await pool.query(
    "SELECT id, status, empresa_id, elevador_id FROM orcamentos WHERE id = ?",
    [orcamentoId]
  );
  if (orcRows.length === 0) {
    return res.status(404).json({ message: "Orçamento não encontrado" });
  }
  const orc = orcRows[0];

  if (elevador_id === undefined) {
    return res.status(400).json({ message: "elevador_id é obrigatório" });
  }

  if (elevador_id === null) {
    // Volta para fila
    let newStatus = orc.status;
    if (newStatus === "Oficina" || newStatus === "Faturado") {
      newStatus = "Aprovado";
    }
    await pool.query(
      "UPDATE orcamentos SET elevador_id = NULL, status = ? WHERE id = ?",
      [newStatus, orcamentoId]
    );
    return res.json({ message: "OK" });
  }

  const novoElevadorId = Number(elevador_id);
  if (!novoElevadorId || Number.isNaN(novoElevadorId)) {
    return res.status(400).json({ message: "elevador_id inválido" });
  }

  const [elevRows] = await pool.query(
    "SELECT id, empresa_id FROM elevadores WHERE id = ?",
    [novoElevadorId]
  );
  if (elevRows.length === 0) {
    return res.status(404).json({ message: "Elevador não encontrado" });
  }
  const elev = elevRows[0];

  if (
    orc.empresa_id != null &&
    elev.empresa_id != null &&
    Number(orc.empresa_id) !== Number(elev.empresa_id)
  ) {
    return res.status(400).json({ message: "Elevador pertence a outra empresa" });
  }

  await pool.query(
    "UPDATE orcamentos SET elevador_id = ?, status = 'Oficina' WHERE id = ?",
    [novoElevadorId, orcamentoId]
  );

  return res.json({ message: "OK" });
}

async function updatePatioChecklist(req, res) {
  const pool = getPool();
  const orcamentoId = Number(req.params.orcamentoId);
  if (!orcamentoId || Number.isNaN(orcamentoId)) {
    return res.status(400).json({ message: "orcamentoId inválido" });
  }

  const { item_id, concluido } = req.body || {};
   const concluidoBool = !!concluido;
  const itemId = Number(item_id);
  if (!itemId || Number.isNaN(itemId)) {
    return res.status(400).json({ message: "item_id inválido" });
  }

  const [orcRows] = await pool.query(
    "SELECT status, elevador_id, json_itens_servico FROM orcamentos WHERE id = ?",
    [orcamentoId]
  );
  if (orcRows.length === 0) {
    return res.status(404).json({ message: "Orçamento não encontrado" });
  }

  const orcamentoRow = orcRows[0];
  const servicos = toServicosFromJson(orcamentoRow.json_itens_servico);
  if (!Array.isArray(servicos) || servicos.length === 0) {
    return res.status(404).json({ message: "Checklist não encontrado para este orçamento" });
  }

  let found = false;
  for (const servico of servicos) {
    if (!Array.isArray(servico.itens)) continue;
    for (const it of servico.itens) {
      if (Number(it.item_id) === itemId) {
        it.concluido = concluidoBool;
        found = true;
        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    return res.status(404).json({ message: "Item de checklist não encontrado" });
  }

  await pool.query(
    "UPDATE orcamentos SET json_itens_servico = ? WHERE id = ?",
    [JSON.stringify(servicos), orcamentoId]
  );

  // Regra: se o orçamento está Faturado e algum item foi desmarcado (concluido=false),
  // ele deve sair da coluna Finalizado e voltar para o elevador/fila.
  if (!concluidoBool && orcamentoRow.status === "Faturado") {
    const hasElevador = orcamentoRow.elevador_id != null;
    const newStatus = hasElevador ? "Oficina" : "Aprovado";
    await pool.query(
      "UPDATE orcamentos SET status = ? WHERE id = ?",
      [newStatus, orcamentoId]
    );
  }

  return res.json({ message: "OK" });
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
  listPatio,
  movePatio,
  updatePatioChecklist,
};
