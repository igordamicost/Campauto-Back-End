# PROMPT CONSOLIDADO - Implementar Empresas, Orçamentos e Relatórios

```
Você é um desenvolvedor backend especializado em Node.js/Express e MySQL.

CONTEXTO DO PROJETO:
- Express.js com ES6 modules (import/export)
- MySQL database (campauto)
- Padrão: controllers usam baseService.js para CRUD
- Autenticação JWT obrigatória (authMiddleware)
- Swagger para documentação
- Estrutura: controllers/, routes/, swagger/, database/

TAREFA COMPLETA:
Implementar 3 módulos faltantes: EMPRESAS, ORÇAMENTOS e RELATÓRIOS.

═══════════════════════════════════════════════════════════════════════════
MÓDULO 1: EMPRESAS
═══════════════════════════════════════════════════════════════════════════

1.1 SQL (adicionar ao database/setup.sql):
CREATE TABLE IF NOT EXISTS empresas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  row_hash CHAR(32) NOT NULL,
  codigo_empresa VARCHAR(255) NULL,
  nome_fantasia VARCHAR(255) NULL,
  razao_social VARCHAR(255) NULL,
  cnpj VARCHAR(255) NULL,
  inscricao_estadual VARCHAR(255) NULL,
  inscricao_municipal VARCHAR(255) NULL,
  endereco VARCHAR(255) NULL,
  numero VARCHAR(255) NULL,
  complemento VARCHAR(255) NULL,
  bairro VARCHAR(255) NULL,
  municipio VARCHAR(255) NULL,
  uf VARCHAR(2) NULL,
  cep VARCHAR(10) NULL,
  telefone VARCHAR(255) NULL,
  celular VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  site VARCHAR(255) NULL,
  logo VARCHAR(255) NULL,
  observacoes TEXT NULL,
  status VARCHAR(50) NULL DEFAULT 'ATIVA',
  data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_row_hash (row_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

1.2 Controller (controllers/empresasController.js):
- Seguir EXATAMENTE o padrão de clientesController.js
- Usar baseService.listWithFilters para listagem
- Métodos: list, getById, create, update, remove

1.3 Routes (routes/empresas.js):
- Aplicar authMiddleware em todas as rotas
- Rotas: GET /, GET /:id, POST /, PUT /:id, DELETE /:id
- Usar asyncHandler

1.4 Swagger (swagger/empresas.js):
- Documentar todos os endpoints
- Marcar segurança bearerAuth

═══════════════════════════════════════════════════════════════════════════
MÓDULO 2: ORÇAMENTOS
═══════════════════════════════════════════════════════════════════════════

2.1 SQL (adicionar ao database/setup.sql):
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

2.2 Controller (controllers/orcamentosController.js):
LÓGICA ESPECIAL NECESSÁRIA:

- list: usar baseService.listWithFilters, mas permitir JOINs opcionais
- getById: retornar com relacionamentos (clientes, empresas, veiculos)
- create:
  * Gerar numero_sequencial: SELECT MAX(numero_sequencial) + 1 FROM orcamentos
  * Calcular totais dos json_itens antes de salvar
  * Validar cliente_id obrigatório
- update: recalcular totais se json_itens mudar
- updateStatus: método especial para mudar status

Estrutura json_itens esperada:
[
  {
    "produto": "string",
    "quantidade": number,
    "unidade": "string",
    "preco_unitario": number,
    "total": number
  }
]

Cálculo de totais:
- subtotal = soma de todos os itens.total
- total = subtotal - desconto

2.3 Routes (routes/orcamentos.js):
- Rotas padrão: GET /, GET /:id, POST /, PUT /:id, DELETE /:id
- Rota especial: PATCH /:id/status (body: { status: "Aprovado" })

2.4 Swagger (swagger/orcamentos.js):
- Documentar estrutura de json_itens
- Explicar status possíveis: 'Cotação', 'Aprovado', 'Separado', 'Faturado', 'Cancelado'

═══════════════════════════════════════════════════════════════════════════
MÓDULO 3: RELATÓRIOS
═══════════════════════════════════════════════════════════════════════════

3.1 Controller (controllers/relatoriosController.js):
Criar métodos para análises (sem tabela própria):

a) vendasPorPeriodo:
   Query params: data_inicio, data_fim, empresa_id (opcional)
   Retornar: total vendas, quantidade orçamentos, ticket médio
   Agrupar por dia/mês conforme período

b) vendasPorCliente:
   Query params: limite (top N), data_inicio, data_fim (opcional)
   Retornar: ranking clientes por valor total
   JOIN com clientes para pegar nome

c) vendasPorProduto:
   Query params: limite (top N), data_inicio, data_fim (opcional)
   Extrair de json_itens dos orcamentos
   Agrupar por produto e somar quantidades/valores

d) vendasPorStatus:
   Retornar: quantidade e valor total agrupado por status

e) resumoGeral:
   Retornar dashboard:
   - Total clientes
   - Total produtos  
   - Total orçamentos
   - Total faturado (status='Faturado')
   - Orçamentos mês atual
   - Ticket médio

3.2 Routes (routes/relatorios.js):
GET /vendas-por-periodo
GET /vendas-por-cliente
GET /vendas-por-produto
GET /vendas-por-status
GET /resumo-geral

3.3 Swagger (swagger/relatorios.js):
- Documentar todos os endpoints
- Explicar query params
- Exemplos de response

═══════════════════════════════════════════════════════════════════════════
ATUALIZAÇÕES NECESSÁRIAS
═══════════════════════════════════════════════════════════════════════════

4.1 app.js:
Adicionar imports:
import empresasRoutes from "./routes/empresas.js";
import orcamentosRoutes from "./routes/orcamentos.js";
import relatoriosRoutes from "./routes/relatorios.js";

Adicionar rotas:
app.use("/empresas", empresasRoutes);
app.use("/orcamentos", orcamentosRoutes);
app.use("/relatorios", relatoriosRoutes);

═══════════════════════════════════════════════════════════════════════════
REQUISITOS OBRIGATÓRIOS PARA TODOS OS MÓDULOS
═══════════════════════════════════════════════════════════════════════════

✅ Autenticação JWT em todas as rotas (authMiddleware)
✅ Busca geral (q) em todas as colunas textuais
✅ Filtros por coluna (qualquer coluna como query param)
✅ Ordenação (sortBy, sortDir)
✅ Paginação (page, limit)
✅ Tratamento de erros com asyncHandler
✅ Swagger documentado
✅ Validação de dados obrigatórios
✅ Seguir padrão de código existente

═══════════════════════════════════════════════════════════════════════════
ENTREGÁVEIS ESPERADOS
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
NOTAS IMPORTANTES
═══════════════════════════════════════════════════════════════════════════

- Orçamentos: numero_sequencial deve ser único e auto-incrementar
- Orçamentos: Calcular totais automaticamente ao criar/atualizar
- Relatórios: Apenas leitura (GET), validar parâmetros de data
- Relatórios: Usar índices existentes para performance
- Todos: Manter consistência com código existente
- Todos: Usar nomes EXATOS dos campos da tabela
- Todos: Testar todos os endpoints após implementação

═══════════════════════════════════════════════════════════════════════════

Implemente todos os módulos seguindo rigorosamente este prompt.
```
