# PROMPT PARA BACKEND - Alinhado com Frontend

Este prompt contém a estrutura EXATA que o frontend espera. Implemente seguindo rigorosamente estas especificações.

---

## 📋 MÓDULO 1: EMPRESAS

### Estrutura da Tabela (database/setup.sql)

```sql
CREATE TABLE IF NOT EXISTS empresas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  row_hash CHAR(32) NOT NULL,
  nome_fantasia VARCHAR(255) NULL,
  razao_social VARCHAR(255) NULL,
  cnpj VARCHAR(255) NULL,
  endereco VARCHAR(255) NULL,
  cep VARCHAR(10) NULL,
  email VARCHAR(255) NULL,
  cidade VARCHAR(255) NULL,
  telefone VARCHAR(255) NULL,
  estado VARCHAR(2) NULL,
  data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_row_hash (row_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**NOTA IMPORTANTE**: O frontend usa `cidade` e `estado` (não `municipio` e `uf`). Use exatamente esses nomes.

### Endpoints Obrigatórios

#### GET /empresas
**Query Params esperados pelo frontend:**
- `page` (opcional, padrão: 1)
- `limit` ou `perPage` (opcional, padrão: 10)
- `q` (opcional) - busca geral em nome_fantasia, razao_social, cnpj
- `nome_fantasia` (opcional) - filtro exato
- `cidade` (opcional) - filtro
- `estado` (opcional) - filtro
- `sortBy` (opcional) - coluna para ordenação
- `sortDir` (opcional) - 'asc' ou 'desc'

**Response esperado pelo frontend:**
```json
{
  "data": [
    {
      "id": 1,
      "nome_fantasia": "Empresa Exemplo",
      "razao_social": "Empresa Exemplo LTDA",
      "cnpj": "12.345.678/0001-90",
      "endereco": "Rua Exemplo, 123",
      "cep": "12345-678",
      "email": "contato@exemplo.com",
      "cidade": "São Paulo",
      "telefone": "(11) 1234-5678",
      "estado": "SP"
    }
  ],
  "page": 1,
  "perPage": 10,
  "total": 100,
  "totalPages": 10
}
```

#### GET /empresas/:id
**Response esperado:**
```json
{
  "id": 1,
  "nome_fantasia": "Empresa Exemplo",
  "razao_social": "Empresa Exemplo LTDA",
  "cnpj": "12.345.678/0001-90",
  "endereco": "Rua Exemplo, 123",
  "cep": "12345-678",
  "email": "contato@exemplo.com",
  "cidade": "São Paulo",
  "telefone": "(11) 1234-5678",
  "estado": "SP"
}
```

#### POST /empresas
**Body esperado pelo frontend:**
```json
{
  "nome_fantasia": "Empresa Exemplo",  // OBRIGATÓRIO
  "razao_social": "Empresa Exemplo LTDA",
  "cnpj": "12.345.678/0001-90",
  "endereco": "Rua Exemplo, 123",
  "cep": "12345-678",
  "email": "contato@exemplo.com",
  "cidade": "São Paulo",
  "telefone": "(11) 1234-5678",
  "estado": "SP"
}
```

**Response esperado:**
```json
{
  "id": 1
}
```

#### PUT /empresas/:id
**Body**: Mesmo formato do POST
**Response**: `{ "message": "Updated" }`

#### DELETE /empresas/:id
**Response**: `{ "message": "Deleted" }`

**Validação**: Se empresa estiver vinculada a orçamentos, retornar erro 400 com mensagem apropriada.

### Swagger (swagger/empresas.js)

```javascript
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
 *         description: Busca geral (nome_fantasia, razao_social, cnpj)
 *       - in: query
 *         name: cidade
 *         schema:
 *           type: string
 *         description: Filtrar por cidade
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *         description: Filtrar por estado (2 caracteres)
 *     responses:
 *       200:
 *         description: Lista de empresas paginada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 page:
 *                   type: integer
 *                 perPage:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
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
 *                 maxLength: 2
 *     responses:
 *       201:
 *         description: Empresa criada
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
 *       400:
 *         description: Empresa vinculada a orçamentos
 */
```

---

## 📋 MÓDULO 2: ORÇAMENTOS

### Estrutura da Tabela (database/setup.sql)

```sql
CREATE TABLE IF NOT EXISTS orcamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  row_hash CHAR(32) NOT NULL,
  numero_sequencial INT NOT NULL,
  cliente_id INT NULL,
  empresa_id INT NULL,
  veiculo_id INT NULL,
  data DATE NOT NULL,
  prazo_entrega VARCHAR(255) NULL,
  validade VARCHAR(255) NULL,
  status VARCHAR(50) NULL DEFAULT 'Cotação',
  observacoes_internas TEXT NULL,
  observacoes_cliente TEXT NULL,
  json_itens JSON NULL,
  subtotal DECIMAL(10,2) NULL DEFAULT 0.00,
  desconto DECIMAL(10,2) NULL DEFAULT 0.00,
  total DECIMAL(10,2) NULL DEFAULT 0.00,
  usuario_id INT NULL,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_row_hash (row_hash),
  UNIQUE KEY uniq_numero_sequencial (numero_sequencial),
  KEY idx_cliente (cliente_id),
  KEY idx_empresa (empresa_id),
  KEY idx_status (status),
  KEY idx_data (data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Estrutura de json_itens (CRÍTICO)

O frontend espera exatamente esta estrutura:

```json
[
  {
    "produto": "Nome do Produto",
    "quantidade": 2,
    "unidade": "UN",
    "preco_unitario": 100.50,
    "total": 201.00
  }
]
```

**IMPORTANTE**: 
- `json_itens` é um array de objetos
- Cada item tem: produto (string), quantidade (number), unidade (string), preco_unitario (number), total (number)
- O frontend calcula `total = quantidade * preco_unitario` antes de enviar
- O backend deve validar e recalcular se necessário

### Status Válidos

O frontend usa exatamente estes valores:
- `'Cotação'` (padrão)
- `'Aprovado'`
- `'Separado'`
- `'Faturado'`
- `'Cancelado'`

### Endpoints Obrigatórios

#### GET /orcamentos
**Query Params esperados:**
- `page`, `limit`, `q`, `sortBy`, `sortDir` (padrão)
- `include` (opcional) - string com relacionamentos: `"clientes,empresas,veiculos"` ou `"clientes,empresas"`
- `status` (opcional) - filtrar por status
- `cliente_id` (opcional) - filtrar por cliente
- `empresa_id` (opcional) - filtrar por empresa

**Response esperado pelo frontend (COM relacionamentos):**
```json
{
  "data": [
    {
      "id": 1,
      "numero_sequencial": 1001,
      "cliente_id": 5,
      "empresa_id": 2,
      "veiculo_id": 10,
      "data": "2024-01-15",
      "prazo_entrega": "7 dias",
      "validade": "30 dias",
      "status": "Cotação",
      "observacoes_internas": "Observação interna",
      "json_itens": [
        {
          "produto": "Produto A",
          "quantidade": 2,
          "unidade": "UN",
          "preco_unitario": 100.50,
          "total": 201.00
        }
      ],
      "subtotal": 201.00,
      "desconto": 0.00,
      "total": 201.00,
      "clientes": {
        "nome": "João Silva",
        "empresa": "Empresa do João",
        "email": "joao@email.com",
        "cpf_cnpj": "123.456.789-00"
      },
      "empresas": {
        "nome_fantasia": "Minha Empresa",
        "razao_social": "Minha Empresa LTDA",
        "cnpj": "12.345.678/0001-90",
        "endereco": "Rua Exemplo",
        "telefone": "(11) 1234-5678",
        "email": "contato@empresa.com"
      },
      "veiculos": {
        "marca": "Toyota",
        "modelo": "Corolla",
        "placa": "ABC-1234",
        "ano": "2020",
        "renavan": "12345678901"
      }
    }
  ],
  "page": 1,
  "perPage": 10,
  "total": 50,
  "totalPages": 5
}
```

**NOTA CRÍTICA**: Se `include` não for passado, retornar apenas os dados do orçamento SEM relacionamentos. Se `include=clientes,empresas,veiculos`, fazer JOINs e incluir os objetos relacionados.

#### GET /orcamentos/:id
**Response**: Mesmo formato do item acima (sempre incluir relacionamentos se existirem)

#### POST /orcamentos
**Body esperado pelo frontend:**
```json
{
  "cliente_id": 5,  // OBRIGATÓRIO
  "empresa_id": 2,
  "veiculo_id": 10,
  "data": "2024-01-15",  // formato YYYY-MM-DD
  "prazo_entrega": "7 dias",
  "validade": "30 dias",
  "status": "Cotação",
  "observacoes_internas": "Observação",
  "json_itens": [
    {
      "produto": "Produto A",
      "quantidade": 2,
      "unidade": "UN",
      "preco_unitario": 100.50,
      "total": 201.00
    }
  ]
}
```

**Lógica obrigatória:**
1. Gerar `numero_sequencial` automaticamente: `SELECT COALESCE(MAX(numero_sequencial), 0) + 1 FROM orcamentos`
2. Calcular `subtotal` = soma de todos `json_itens[].total`
3. Calcular `total` = `subtotal - desconto` (desconto padrão 0)
4. Validar `cliente_id` existe

**Response esperado:**
```json
{
  "id": 1,
  "numero_sequencial": 1001
}
```

#### PUT /orcamentos/:id
**Body**: Mesmo formato do POST (todos os campos opcionais exceto validações)
**Lógica**: Recalcular totais se `json_itens` for enviado
**Response**: `{ "message": "Updated" }`

#### PATCH /orcamentos/:id/status
**Body esperado pelo frontend:**
```json
{
  "status": "Aprovado"
}
```

**Response**: `{ "message": "Status updated" }`

**Validação**: Status deve ser um dos valores válidos listados acima.

#### DELETE /orcamentos/:id
**Response**: `{ "message": "Deleted" }`

### Swagger (swagger/orcamentos.js)

```javascript
/**
 * @openapi
 * /orcamentos:
 *   get:
 *     summary: Lista orçamentos
 *     tags: [Orçamentos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Busca geral
 *       - in: query
 *         name: include
 *         schema:
 *           type: string
 *         description: Relacionamentos a incluir (ex: "clientes,empresas,veiculos")
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Cotação, Aprovado, Separado, Faturado, Cancelado]
 *     responses:
 *       200:
 *         description: Lista de orçamentos
 */

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
 *                   required: [produto, quantidade, unidade, preco_unitario, total]
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

## 📋 MÓDULO 3: RELATÓRIOS

### Endpoints Obrigatórios

O frontend processa os dados localmente, então precisa apenas de um endpoint que retorne todos os orçamentos com relacionamento de clientes.

#### GET /relatorios/orcamentos
**Query Params:**
- `data_inicio` (opcional) - formato YYYY-MM-DD
- `data_fim` (opcional) - formato YYYY-MM-DD
- `status` (opcional) - filtrar por status

**Response esperado pelo frontend:**
```json
{
  "data": [
    {
      "id": 1,
      "numero_sequencial": 1001,
      "data": "2024-01-15",
      "status": "Cotação",
      "json_itens": [
        {
          "produto": "Produto A",
          "quantidade": 2,
          "unidade": "UN",
          "preco_unitario": 100.50,
          "total": 201.00
        }
      ],
      "total": 201.00,
      "clientes": {
        "nome": "João Silva",
        "empresa": "Empresa do João"
      }
    }
  ]
}
```

**NOTA**: O frontend calcula os totais a partir de `json_itens` localmente. Retornar os dados brutos é suficiente.

### Swagger (swagger/relatorios.js)

```javascript
/**
 * @openapi
 * /relatorios/orcamentos:
 *   get:
 *     summary: Lista orçamentos para relatórios
 *     tags: [Relatórios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: data_inicio
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: data_fim
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de orçamentos com relacionamentos
 */
```

---

## 🔧 IMPLEMENTAÇÃO TÉCNICA

### Controller de Orçamentos (exemplo de JOIN)

```javascript
// controllers/orcamentosController.js
async function list(req, res) {
  const pool = getPool();
  const include = req.query.include ? req.query.include.split(',') : [];
  const limit = Number(req.query.limit || 10);
  const page = Math.max(1, Number(req.query.page || 1));
  const offset = (page - 1) * limit;

  // Construir SELECT com JOINs condicionais
  let selectFields = 'o.*';
  let joins = '';
  
  if (include.includes('clientes')) {
    selectFields += ', c.fantasia as cliente_nome, c.empresa as cliente_empresa, c.email as cliente_email, c.cpf_cnpj as cliente_cpf_cnpj';
    joins += ' LEFT JOIN clientes c ON o.cliente_id = c.id';
  }
  
  if (include.includes('empresas')) {
    selectFields += ', e.nome_fantasia as empresa_nome_fantasia, e.razao_social as empresa_razao_social, e.cnpj as empresa_cnpj, e.endereco as empresa_endereco, e.telefone as empresa_telefone, e.email as empresa_email';
    joins += ' LEFT JOIN empresas e ON o.empresa_id = e.id';
  }
  
  if (include.includes('veiculos')) {
    selectFields += ', v.marca as veiculo_marca, v.modelo as veiculo_modelo, v.placa as veiculo_placa, v.ano as veiculo_ano, v.renavan as veiculo_renavan';
    joins += ' LEFT JOIN veiculos v ON o.veiculo_id = v.id';
  }

  // Construir WHERE
  const whereParts = [];
  const params = [];
  
  if (req.query.q) {
    whereParts.push('(o.numero_sequencial LIKE ? OR o.observacoes_internas LIKE ?)');
    params.push(`%${req.query.q}%`, `%${req.query.q}%`);
  }
  
  if (req.query.status) {
    whereParts.push('o.status = ?');
    params.push(req.query.status);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  
  // Query de dados
  const dataSql = `
    SELECT ${selectFields}
    FROM orcamentos o
    ${joins}
    ${whereSql}
    ORDER BY o.numero_sequencial DESC
    LIMIT ? OFFSET ?
  `;
  
  // Query de contagem
  const countSql = `
    SELECT COUNT(*) AS total
    FROM orcamentos o
    ${joins}
    ${whereSql}
  `;

  const [rows] = await pool.query(dataSql, [...params, limit, offset]);
  const [[countRow]] = await pool.query(countSql, params);

  // Transformar resultado para formato esperado pelo frontend
  const data = rows.map(row => {
    const result = {
      id: row.id,
      numero_sequencial: row.numero_sequencial,
      cliente_id: row.cliente_id,
      empresa_id: row.empresa_id,
      veiculo_id: row.veiculo_id,
      data: row.data,
      prazo_entrega: row.prazo_entrega,
      validade: row.validade,
      status: row.status,
      observacoes_internas: row.observacoes_internas,
      json_itens: row.json_itens ? JSON.parse(row.json_itens) : [],
      subtotal: parseFloat(row.subtotal || 0),
      desconto: parseFloat(row.desconto || 0),
      total: parseFloat(row.total || 0)
    };

    // Adicionar relacionamentos se existirem
    if (include.includes('clientes') && row.cliente_nome) {
      result.clientes = {
        nome: row.cliente_nome,
        empresa: row.cliente_empresa,
        email: row.cliente_email,
        cpf_cnpj: row.cliente_cpf_cnpj
      };
    }

    if (include.includes('empresas') && row.empresa_nome_fantasia) {
      result.empresas = {
        nome_fantasia: row.empresa_nome_fantasia,
        razao_social: row.empresa_razao_social,
        cnpj: row.empresa_cnpj,
        endereco: row.empresa_endereco,
        telefone: row.empresa_telefone,
        email: row.empresa_email
      };
    }

    if (include.includes('veiculos') && row.veiculo_marca) {
      result.veiculos = {
        marca: row.veiculo_marca,
        modelo: row.veiculo_modelo,
        placa: row.veiculo_placa,
        ano: row.veiculo_ano,
        renavan: row.veiculo_renavan
      };
    }

    return result;
  });

  res.json({
    data,
    page,
    perPage: limit,
    total: countRow.total,
    totalPages: Math.ceil(countRow.total / limit)
  });
}
```

### Função para Calcular Totais

```javascript
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
```

### Função para Gerar Numero Sequencial

```javascript
async function getProximoNumeroSequencial() {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT COALESCE(MAX(numero_sequencial), 0) + 1 AS proximo FROM orcamentos'
  );
  return rows[0].proximo;
}
```

---

## ✅ CHECKLIST FINAL

- [ ] Tabela `empresas` criada com campos: cidade, estado (não municipio, uf)
- [ ] Tabela `orcamentos` criada com json_itens como JSON
- [ ] Endpoint GET /empresas retorna formato paginado esperado
- [ ] Endpoint GET /orcamentos suporta `include` para relacionamentos
- [ ] Endpoint POST /orcamentos gera numero_sequencial automaticamente
- [ ] Endpoint POST /orcamentos calcula subtotal e total automaticamente
- [ ] Endpoint PATCH /orcamentos/:id/status existe e valida status
- [ ] json_itens é armazenado e retornado como array JSON válido
- [ ] Relacionamentos retornam objetos aninhados quando `include` é usado
- [ ] Swagger documentado para todos os endpoints
- [ ] Autenticação JWT em todas as rotas
- [ ] Busca geral (q) funcionando
- [ ] Filtros por coluna funcionando
- [ ] Ordenação funcionando

---

## 🚨 PONTOS CRÍTICOS

1. **Nomes de campos**: Use `cidade` e `estado` para empresas (não `municipio` e `uf`)
2. **json_itens**: Deve ser array JSON válido, não string
3. **Relacionamentos**: Retornar como objetos aninhados quando `include` for usado
4. **numero_sequencial**: Deve ser único e auto-incrementar
5. **Totais**: Calcular automaticamente ao criar/atualizar
6. **Status**: Validar valores permitidos

---

**Implemente seguindo EXATAMENTE estas especificações para garantir compatibilidade total com o frontend.**
