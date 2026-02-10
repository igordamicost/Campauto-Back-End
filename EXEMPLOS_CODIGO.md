# Exemplos de Código - Referência para Implementação

Este arquivo contém exemplos de código que podem ser usados como referência ao implementar os módulos.

---

## 📋 Exemplo 1: Controller Simples (Empresas)

```javascript
// controllers/empresasController.js
import * as baseService from "../services/baseService.js";

const TABLE = 'empresas';

async function list(req, res) {
  const limit = Number(req.query.limit || req.query.perPage || 10);
  const page = Math.max(1, Number(req.query.page || 1));
  const offset = (page - 1) * limit;
  const { data, total } = await baseService.listWithFilters(TABLE, req.query);
  const totalPages = Math.ceil(total / limit) || 1;
  res.json({ data, page, perPage: limit, total, totalPages });
}

async function getById(req, res) {
  const item = await baseService.getById(TABLE, req.params.id);
  if (!item) return res.status(404).json({ message: 'Not found' });
  res.json(item);
}

async function create(req, res) {
  // Validação básica
  if (!req.body.nome_fantasia) {
    return res.status(400).json({ message: 'nome_fantasia é obrigatório' });
  }
  
  const id = await baseService.create(TABLE, req.body || {});
  if (!id) return res.status(409).json({ message: 'Duplicate or invalid' });
  res.status(201).json({ id });
}

async function update(req, res) {
  const ok = await baseService.update(TABLE, req.params.id, req.body || {});
  if (!ok) return res.status(404).json({ message: 'Not found or empty body' });
  res.json({ message: 'Updated' });
}

async function remove(req, res) {
  const ok = await baseService.remove(TABLE, req.params.id);
  if (!ok) return res.status(404).json({ message: 'Not found' });
  res.json({ message: 'Deleted' });
}

export { list, getById, create, update, remove };
```

---

## 📋 Exemplo 2: Controller com Lógica Especial (Orçamentos)

```javascript
// controllers/orcamentosController.js
import * as baseService from "../services/baseService.js";
import { getPool } from "../db.js";

const TABLE = 'orcamentos';

// Função auxiliar para calcular totais dos itens
function calcularTotais(jsonItens, desconto = 0) {
  if (!jsonItens || !Array.isArray(jsonItens)) {
    return { subtotal: 0, desconto: 0, total: 0 };
  }
  
  const subtotal = jsonItens.reduce((sum, item) => {
    const total = parseFloat(item.total) || 0;
    return sum + total;
  }, 0);
  
  const descontoValue = parseFloat(desconto) || 0;
  const total = subtotal - descontoValue;
  
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    desconto: parseFloat(descontoValue.toFixed(2)),
    total: parseFloat(total.toFixed(2))
  };
}

// Função auxiliar para gerar próximo número sequencial
async function getProximoNumeroSequencial() {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT COALESCE(MAX(numero_sequencial), 0) + 1 AS proximo FROM orcamentos'
  );
  return rows[0].proximo;
}

async function list(req, res) {
  const limit = Number(req.query.limit || req.query.perPage || 10);
  const page = Math.max(1, Number(req.query.page || 1));
  const offset = (page - 1) * limit;
  
  // Se incluir relacionamentos
  const include = req.query.include ? req.query.include.split(',') : [];
  const { data, total } = await baseService.listWithFilters(TABLE, req.query);
  
  // Adicionar JOINs se solicitado
  if (include.includes('clientes') || include.includes('empresas')) {
    // Implementar JOINs aqui se necessário
  }
  
  const totalPages = Math.ceil(total / limit) || 1;
  res.json({ data, page, perPage: limit, total, totalPages });
}

async function getById(req, res) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT o.*, 
     c.fantasia as cliente_nome, c.email as cliente_email,
     e.nome_fantasia as empresa_nome
     FROM orcamentos o
     LEFT JOIN clientes c ON o.cliente_id = c.id
     LEFT JOIN empresas e ON o.empresa_id = e.id
     WHERE o.id = ?`,
    [req.params.id]
  );
  
  if (!rows[0]) return res.status(404).json({ message: 'Not found' });
  res.json(rows[0]);
}

async function create(req, res) {
  // Validação
  if (!req.body.cliente_id) {
    return res.status(400).json({ message: 'cliente_id é obrigatório' });
  }
  
  // Gerar número sequencial
  const numeroSequencial = await getProximoNumeroSequencial();
  
  // Calcular totais
  const { subtotal, desconto, total } = calcularTotais(
    req.body.json_itens,
    req.body.desconto || 0
  );
  
  // Preparar dados
  const dados = {
    ...req.body,
    numero_sequencial: numeroSequencial,
    subtotal,
    desconto,
    total
  };
  
  const id = await baseService.create(TABLE, dados);
  if (!id) return res.status(409).json({ message: 'Duplicate or invalid' });
  
  res.status(201).json({ id, numero_sequencial });
}

async function update(req, res) {
  const dados = { ...req.body };
  
  // Recalcular totais se json_itens mudou
  if (dados.json_itens) {
    const { subtotal, desconto, total } = calcularTotais(
      dados.json_itens,
      dados.desconto || 0
    );
    dados.subtotal = subtotal;
    dados.desconto = desconto || 0;
    dados.total = total;
  }
  
  const ok = await baseService.update(TABLE, req.params.id, dados);
  if (!ok) return res.status(404).json({ message: 'Not found or empty body' });
  res.json({ message: 'Updated' });
}

async function updateStatus(req, res) {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ message: 'status é obrigatório' });
  }
  
  const ok = await baseService.update(TABLE, req.params.id, { status });
  if (!ok) return res.status(404).json({ message: 'Not found' });
  res.json({ message: 'Status updated' });
}

async function remove(req, res) {
  const ok = await baseService.remove(TABLE, req.params.id);
  if (!ok) return res.status(404).json({ message: 'Not found' });
  res.json({ message: 'Deleted' });
}

export { list, getById, create, update, remove, updateStatus };
```

---

## 📋 Exemplo 3: Routes (Empresas)

```javascript
// routes/empresas.js
import express from "express";
import * as controller from "../controllers/empresasController.js";
import { authMiddleware } from "../src/middlewares/auth.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authMiddleware);

router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.getById));
router.post('/', asyncHandler(controller.create));
router.put('/:id', asyncHandler(controller.update));
router.delete('/:id', asyncHandler(controller.remove));

export default router;
```

---

## 📋 Exemplo 4: Routes (Orçamentos com rota especial)

```javascript
// routes/orcamentos.js
import express from "express";
import * as controller from "../controllers/orcamentosController.js";
import { authMiddleware } from "../src/middlewares/auth.js";

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authMiddleware);

router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.getById));
router.post('/', asyncHandler(controller.create));
router.put('/:id', asyncHandler(controller.update));
router.patch('/:id/status', asyncHandler(controller.updateStatus));
router.delete('/:id', asyncHandler(controller.remove));

export default router;
```

---

## 📋 Exemplo 5: Controller de Relatórios

```javascript
// controllers/relatoriosController.js
import { getPool } from "../db.js";

async function vendasPorPeriodo(req, res) {
  const { data_inicio, data_fim, empresa_id } = req.query;
  
  if (!data_inicio || !data_fim) {
    return res.status(400).json({ 
      message: 'data_inicio e data_fim são obrigatórios' 
    });
  }
  
  const pool = getPool();
  let sql = `
    SELECT 
      DATE(data) as data,
      COUNT(*) as quantidade,
      SUM(total) as valor_total,
      AVG(total) as ticket_medio
    FROM orcamentos
    WHERE data BETWEEN ? AND ?
  `;
  const params = [data_inicio, data_fim];
  
  if (empresa_id) {
    sql += ' AND empresa_id = ?';
    params.push(empresa_id);
  }
  
  sql += ' GROUP BY DATE(data) ORDER BY data';
  
  const [rows] = await pool.query(sql, params);
  
  const totalizadores = rows.reduce((acc, row) => ({
    quantidade: acc.quantidade + row.quantidade,
    valor_total: acc.valor_total + parseFloat(row.valor_total || 0),
  }), { quantidade: 0, valor_total: 0 });
  
  totalizadores.ticket_medio = totalizadores.quantidade > 0 
    ? totalizadores.valor_total / totalizadores.quantidade 
    : 0;
  
  res.json({
    periodo: { inicio: data_inicio, fim: data_fim },
    dados: rows,
    totalizadores
  });
}

async function vendasPorCliente(req, res) {
  const { limite = 10, data_inicio, data_fim } = req.query;
  const pool = getPool();
  
  let sql = `
    SELECT 
      c.id,
      c.fantasia as nome_cliente,
      COUNT(o.id) as quantidade_orcamentos,
      SUM(o.total) as valor_total
    FROM orcamentos o
    INNER JOIN clientes c ON o.cliente_id = c.id
  `;
  const params = [];
  
  if (data_inicio && data_fim) {
    sql += ' WHERE o.data BETWEEN ? AND ?';
    params.push(data_inicio, data_fim);
  }
  
  sql += `
    GROUP BY c.id, c.fantasia
    ORDER BY valor_total DESC
    LIMIT ?
  `;
  params.push(parseInt(limite));
  
  const [rows] = await pool.query(sql, params);
  res.json({ dados: rows });
}

async function vendasPorProduto(req, res) {
  const { limite = 10, data_inicio, data_fim } = req.query;
  const pool = getPool();
  
  // MySQL 8.0+ com JSON_TABLE
  let sql = `
    SELECT 
      item.produto,
      SUM(item.quantidade) as quantidade_total,
      SUM(item.total) as valor_total
    FROM orcamentos o,
    JSON_TABLE(
      o.json_itens,
      '$[*]' COLUMNS (
        produto VARCHAR(255) PATH '$.produto',
        quantidade DECIMAL(10,2) PATH '$.quantidade',
        total DECIMAL(10,2) PATH '$.total'
      )
    ) AS item
  `;
  const params = [];
  
  if (data_inicio && data_fim) {
    sql += ' WHERE o.data BETWEEN ? AND ?';
    params.push(data_inicio, data_fim);
  }
  
  sql += `
    GROUP BY item.produto
    ORDER BY valor_total DESC
    LIMIT ?
  `;
  params.push(parseInt(limite));
  
  const [rows] = await pool.query(sql, params);
  res.json({ dados: rows });
}

async function vendasPorStatus(req, res) {
  const pool = getPool();
  const [rows] = await pool.query(`
    SELECT 
      status,
      COUNT(*) as quantidade,
      SUM(total) as valor_total
    FROM orcamentos
    GROUP BY status
    ORDER BY valor_total DESC
  `);
  
  res.json({ dados: rows });
}

async function resumoGeral(req, res) {
  const pool = getPool();
  
  // Total de clientes
  const [clientes] = await pool.query('SELECT COUNT(*) as total FROM clientes');
  
  // Total de produtos
  const [produtos] = await pool.query('SELECT COUNT(*) as total FROM produtos');
  
  // Total de orçamentos
  const [orcamentos] = await pool.query('SELECT COUNT(*) as total FROM orcamentos');
  
  // Total faturado
  const [faturado] = await pool.query(
    "SELECT SUM(total) as total FROM orcamentos WHERE status = 'Faturado'"
  );
  
  // Orçamentos do mês atual
  const [mesAtual] = await pool.query(`
    SELECT COUNT(*) as quantidade, SUM(total) as valor_total
    FROM orcamentos
    WHERE MONTH(data) = MONTH(CURRENT_DATE())
    AND YEAR(data) = YEAR(CURRENT_DATE())
  `);
  
  // Ticket médio geral
  const [ticketMedio] = await pool.query(`
    SELECT AVG(total) as ticket_medio FROM orcamentos WHERE total > 0
  `);
  
  res.json({
    total_clientes: clientes[0].total,
    total_produtos: produtos[0].total,
    total_orcamentos: orcamentos[0].total,
    total_faturado: parseFloat(faturado[0].total || 0),
    mes_atual: {
      quantidade: mesAtual[0].quantidade,
      valor_total: parseFloat(mesAtual[0].valor_total || 0)
    },
    ticket_medio: parseFloat(ticketMedio[0].ticket_medio || 0)
  });
}

export { 
  vendasPorPeriodo, 
  vendasPorCliente, 
  vendasPorProduto, 
  vendasPorStatus,
  resumoGeral 
};
```

---

## 📋 Exemplo 6: Swagger (Empresas)

```javascript
// swagger/empresas.js
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
 *         name: q
 *         schema:
 *           type: string
 *         description: Busca geral
 *       - in: query
 *         name: municipio
 *         schema:
 *           type: string
 *         description: Filtrar por município
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
```

---

## 📋 Exemplo 7: Swagger (Orçamentos)

```javascript
// swagger/orcamentos.js
/**
 * @openapi
 * /orcamentos:
 *   post:
 *     summary: Cria orçamento
 *     tags: [Orçamentos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cliente_id, data]
 *             properties:
 *               cliente_id:
 *                 type: integer
 *               empresa_id:
 *                 type: integer
 *               veiculo_id:
 *                 type: integer
 *               data:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [Cotação, Aprovado, Separado, Faturado, Cancelado]
 *               json_itens:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     produto:
 *                       type: string
 *                     quantidade:
 *                       type: number
 *                     unidade:
 *                       type: string
 *                     preco_unitario:
 *                       type: number
 *                     total:
 *                       type: number
 *     responses:
 *       201:
 *         description: Orçamento criado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 numero_sequencial:
 *                   type: integer
 */

/**
 * @openapi
 * /orcamentos/{id}/status:
 *   patch:
 *     summary: Atualiza status do orçamento
 *     tags: [Orçamentos]
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
 *                 enum: [Cotação, Aprovado, Separado, Faturado, Cancelado]
 *     responses:
 *       200:
 *         description: Status atualizado
 */
```

---

## 📋 Exemplo 8: Swagger (Relatórios)

```javascript
// swagger/relatorios.js
/**
 * @openapi
 * /relatorios/vendas-por-periodo:
 *   get:
 *     summary: Relatório de vendas por período
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: data_inicio
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: data_fim
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: empresa_id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Dados do relatório
 */

/**
 * @openapi
 * /relatorios/resumo-geral:
 *   get:
 *     summary: Resumo geral do sistema
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumo geral
 */
```

---

## ✅ Checklist de Implementação

Use este checklist ao implementar cada módulo:

- [ ] Tabela criada no database/setup.sql
- [ ] Controller criado seguindo padrão
- [ ] Routes criadas com authMiddleware
- [ ] Swagger documentado
- [ ] app.js atualizado
- [ ] Testado busca geral (q)
- [ ] Testado filtros por coluna
- [ ] Testado ordenação
- [ ] Testado paginação
- [ ] Testado CRUD completo
- [ ] Validado autenticação JWT

---

## 🔍 Dicas de Debug

1. **Verificar se tabela existe**: `SHOW TABLES LIKE 'nome_tabela';`
2. **Verificar estrutura**: `DESCRIBE nome_tabela;`
3. **Testar query manualmente**: Use MySQL Workbench ou CLI
4. **Verificar logs**: Console.log nos controllers para debug
5. **Validar JSON**: json_itens deve ser array válido
6. **Verificar índices**: `SHOW INDEX FROM nome_tabela;`
