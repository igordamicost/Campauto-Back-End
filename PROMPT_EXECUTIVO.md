# PROMPT EXECUTIVO - Backend Alinhado com Frontend

Cole este prompt no Cursor AI do backend para implementar os módulos faltantes.

---

```
Você é um desenvolvedor backend especializado em Node.js/Express e MySQL.

CONTEXTO:
- Express.js com ES6 modules
- MySQL database (campauto)
- Padrão: controllers usam baseService.js
- Autenticação JWT obrigatória (authMiddleware)
- Frontend já está pronto e espera estruturas específicas

TAREFA:
Implementar 3 módulos: EMPRESAS, ORÇAMENTOS e RELATÓRIOS seguindo EXATAMENTE o que o frontend espera.

═══════════════════════════════════════════════════════════════════════════
1. EMPRESAS
═══════════════════════════════════════════════════════════════════════════

SQL (database/setup.sql):
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

IMPORTANTE: Frontend usa "cidade" e "estado" (NÃO "municipio" e "uf")

Endpoints:
- GET /empresas - Retorna: { data: [], page, perPage, total, totalPages }
- GET /empresas/:id - Retorna objeto empresa
- POST /empresas - Body: { nome_fantasia (obrigatório), razao_social, cnpj, endereco, cep, email, cidade, telefone, estado }
- PUT /empresas/:id - Mesmo body do POST
- DELETE /empresas/:id

Query params suportados: page, limit, q (busca), cidade, estado, sortBy, sortDir

═══════════════════════════════════════════════════════════════════════════
2. ORÇAMENTOS
═══════════════════════════════════════════════════════════════════════════

SQL (database/setup.sql):
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

Estrutura json_itens (CRÍTICO):
[
  {
    "produto": "string",
    "quantidade": number,
    "unidade": "string",
    "preco_unitario": number,
    "total": number
  }
]

Status válidos: 'Cotação', 'Aprovado', 'Separado', 'Faturado', 'Cancelado'

Endpoints:
- GET /orcamentos
  * Query param "include" (opcional): "clientes,empresas,veiculos"
  * Se include usado, fazer JOINs e retornar objetos aninhados:
    {
      "id": 1,
      "numero_sequencial": 1001,
      "data": "2024-01-15",
      "status": "Cotação",
      "json_itens": [...],
      "total": 201.00,
      "clientes": { "nome": "...", "empresa": "..." },
      "empresas": { "nome_fantasia": "...", ... },
      "veiculos": { "marca": "...", "modelo": "...", "placa": "..." }
    }
  * Retornar formato paginado: { data: [], page, perPage, total, totalPages }

- GET /orcamentos/:id - Sempre incluir relacionamentos se existirem

- POST /orcamentos
  * Body: { cliente_id (obrigatório), empresa_id, veiculo_id, data, status, json_itens, ... }
  * LÓGICA OBRIGATÓRIA:
    1. Gerar numero_sequencial: SELECT COALESCE(MAX(numero_sequencial), 0) + 1
    2. Calcular subtotal = soma de json_itens[].total
    3. Calcular total = subtotal - desconto
    4. Validar cliente_id existe
  * Response: { id, numero_sequencial }

- PUT /orcamentos/:id
  * Recalcular totais se json_itens mudar
  * Response: { message: "Updated" }

- PATCH /orcamentos/:id/status
  * Body: { status: "Aprovado" }
  * Validar status é válido
  * Response: { message: "Status updated" }

- DELETE /orcamentos/:id

═══════════════════════════════════════════════════════════════════════════
3. RELATÓRIOS
═══════════════════════════════════════════════════════════════════════════

Endpoint:
- GET /relatorios/orcamentos
  * Query params: data_inicio, data_fim, status (todos opcionais)
  * Retornar orçamentos COM relacionamento clientes:
    {
      "data": [
        {
          "id": 1,
          "numero_sequencial": 1001,
          "data": "2024-01-15",
          "status": "Cotação",
          "json_itens": [...],
          "total": 201.00,
          "clientes": { "nome": "...", "empresa": "..." }
        }
      ]
    }
  * Frontend processa dados localmente, então retornar dados brutos é suficiente

═══════════════════════════════════════════════════════════════════════════
IMPLEMENTAÇÃO TÉCNICA
═══════════════════════════════════════════════════════════════════════════

1. Criar controllers seguindo padrão de clientesController.js
2. Criar routes com authMiddleware em todas as rotas
3. Criar swagger documentation
4. Atualizar app.js com novas rotas

Para Orçamentos:
- Usar JOINs condicionais baseado em query param "include"
- Transformar resultado para formato esperado pelo frontend
- Calcular totais automaticamente
- Gerar numero_sequencial único

Para Empresas:
- Usar baseService.listWithFilters (já suporta q, filtros, ordenação)
- Validar nome_fantasia obrigatório

Para Relatórios:
- Query simples com JOIN em clientes
- Retornar dados brutos (frontend processa)

═══════════════════════════════════════════════════════════════════════════
ENTREGÁVEIS
═══════════════════════════════════════════════════════════════════════════

1. database/setup.sql atualizado (tabelas empresas e orcamentos)
2. controllers/empresasController.js
3. controllers/orcamentosController.js (com lógica especial)
4. controllers/relatoriosController.js
5. routes/empresas.js
6. routes/orcamentos.js
7. routes/relatorios.js
8. swagger/empresas.js
9. swagger/orcamentos.js
10. swagger/relatorios.js
11. app.js atualizado

═══════════════════════════════════════════════════════════════════════════
VALIDAÇÕES CRÍTICAS
═══════════════════════════════════════════════════════════════════════════

✅ Empresas: campos "cidade" e "estado" (não municipio/uf)
✅ Orçamentos: json_itens é array JSON, não string
✅ Orçamentos: numero_sequencial único e auto-incrementar
✅ Orçamentos: calcular totais automaticamente
✅ Orçamentos: relacionamentos como objetos aninhados quando include usado
✅ Status: validar valores permitidos
✅ Autenticação JWT em todas as rotas
✅ Swagger documentado

Implemente seguindo EXATAMENTE estas especificações.
```

---

Este prompt está pronto para ser colado no Cursor AI do backend. Ele contém todas as especificações exatas que o frontend espera.
