# Prompts para Implementação no Backend

Este documento contém prompts detalhados para implementar os módulos faltantes no backend usando Cursor AI.

---

## 📋 PROMPT 1: Tabela e Módulo EMPRESAS

```
Você é um desenvolvedor backend especializado em Node.js/Express e MySQL.

CONTEXTO:
- Projeto usa Express.js com ES6 modules
- Banco de dados MySQL (campauto)
- Padrão de código: controllers usam baseService.js para operações CRUD
- Autenticação JWT obrigatória em todas as rotas protegidas
- Swagger para documentação

TAREFA:
Criar o módulo completo de EMPRESAS seguindo o mesmo padrão de clientes e produtos.

ESTRUTURA DA TABELA empresas:
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

REQUISITOS:

1. SQL (database/setup.sql):
   - Adicionar CREATE TABLE empresas acima
   - Manter padrão de row_hash único

2. Controller (controllers/empresasController.js):
   - Usar baseService.listWithFilters para listagem (suporta q, filtros, sortBy, sortDir)
   - Métodos: list, getById, create, update, remove
   - Seguir exatamente o padrão de clientesController.js

3. Routes (routes/empresas.js):
   - Aplicar authMiddleware em todas as rotas
   - Rotas: GET /, GET /:id, POST /, PUT /:id, DELETE /:id
   - Usar asyncHandler para tratamento de erros

4. Swagger (swagger/empresas.js):
   - Documentar todos os endpoints
   - Incluir exemplos de request/response
   - Marcar segurança bearerAuth

5. app.js:
   - Adicionar: import empresasRoutes from "./routes/empresas.js";
   - Adicionar: app.use("/empresas", empresasRoutes);

6. Funcionalidades obrigatórias:
   - Listagem com paginação (page, limit)
   - Busca geral (q) em todas as colunas
   - Filtros por coluna (nome_fantasia, municipio, uf, status, etc)
   - Ordenação (sortBy, sortDir)
   - CRUD completo
   - Validação de campos obrigatórios (nome_fantasia)

ENTREGÁVEIS:
- Atualizar database/setup.sql
- Criar controllers/empresasController.js
- Criar routes/empresas.js
- Criar swagger/empresas.js
- Atualizar app.js
- Testar todos os endpoints

IMPORTANTE:
- Manter consistência com código existente
- Usar nomes EXATOS dos campos da tabela
- Não criar campos que não existem na tabela
```

---

## 📋 PROMPT 2: Tabela e Módulo ORÇAMENTOS

```
Você é um desenvolvedor backend especializado em Node.js/Express e MySQL.

CONTEXTO:
- Projeto usa Express.js com ES6 modules
- Banco de dados MySQL (campauto)
- Padrão de código: controllers usam baseService.js para operações CRUD
- Autenticação JWT obrigatória em todas as rotas protegidas
- Swagger para documentação
- Frontend já usa orcamentos com relacionamentos (clientes, empresas, veiculos)

TAREFA:
Criar o módulo completo de ORÇAMENTOS seguindo o padrão existente, mas com lógica especial para itens JSON.

ESTRUTURA DA TABELA orcamentos:
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

REQUISITOS:

1. SQL (database/setup.sql):
   - Adicionar CREATE TABLE orcamentos acima
   - Criar índices para performance
   - Manter padrão de row_hash único
   - numero_sequencial deve ser único e auto-incrementar

2. Controller (controllers/orcamentosController.js):
   - Método list: usar baseService.listWithFilters com JOINs opcionais
   - Método getById: retornar com relacionamentos (clientes, empresas, veiculos)
   - Método create: 
     * Gerar numero_sequencial automaticamente (último + 1)
     * Calcular subtotal, desconto, total dos itens JSON
     * Validar cliente_id obrigatório
   - Método update: recalcular totais se json_itens mudar
   - Método remove: soft delete ou hard delete (definir política)
   - Método updateStatus: endpoint especial para mudar status

3. Routes (routes/orcamentos.js):
   - Aplicar authMiddleware em todas as rotas
   - Rotas: GET /, GET /:id, POST /, PUT /:id, DELETE /:id, PATCH /:id/status
   - Usar asyncHandler

4. Swagger (swagger/orcamentos.js):
   - Documentar todos os endpoints
   - Explicar estrutura de json_itens:
     [
       {
         "produto": "string",
         "quantidade": number,
         "unidade": "string",
         "preco_unitario": number,
         "total": number
       }
     ]
   - Exemplos de status: 'Cotação', 'Aprovado', 'Separado', 'Faturado', 'Cancelado'

5. app.js:
   - Adicionar: import orcamentosRoutes from "./routes/orcamentos.js";
   - Adicionar: app.use("/orcamentos", orcamentosRoutes);

6. Funcionalidades obrigatórias:
   - Listagem com paginação (page, limit)
   - Busca geral (q) em numero_sequencial, status, observações
   - Filtros por coluna (cliente_id, empresa_id, status, data)
   - Ordenação (sortBy, sortDir)
   - CRUD completo
   - Cálculo automático de totais
   - Geração automática de numero_sequencial
   - Endpoint para mudança de status
   - Suporte a relacionamentos (JOINs opcionais via query param ?include=clientes,empresas)

7. Lógica especial:
   - Ao criar/atualizar, calcular:
     * subtotal = soma de todos os itens.total
     * total = subtotal - desconto
   - Validar json_itens é array válido
   - Validar cliente_id existe na tabela clientes
   - Validar empresa_id existe na tabela empresas (se fornecido)

ENTREGÁVEIS:
- Atualizar database/setup.sql
- Criar controllers/orcamentosController.js (com lógica especial)
- Criar routes/orcamentos.js
- Criar swagger/orcamentos.js
- Atualizar app.js
- Testar todos os endpoints incluindo cálculos

IMPORTANTE:
- Manter consistência com código existente
- json_itens deve ser armazenado como JSON no MySQL
- numero_sequencial deve ser único e sequencial
- Calcular totais automaticamente
```

---

## 📋 PROMPT 3: Módulo RELATÓRIOS

```
Você é um desenvolvedor backend especializado em Node.js/Express e MySQL.

CONTEXTO:
- Projeto usa Express.js com ES6 modules
- Banco de dados MySQL (campauto)
- Autenticação JWT obrigatória
- Swagger para documentação
- Tabelas existentes: clientes, produtos, empresas, orcamentos

TAREFA:
Criar módulo de RELATÓRIOS com endpoints para análises e estatísticas.

ESTRUTURA:
Não precisa de tabela própria. Relatórios são gerados a partir de queries nas tabelas existentes.

REQUISITOS:

1. Controller (controllers/relatoriosController.js):
   Criar métodos para:

   a) vendasPorPeriodo(req, res):
      - Parâmetros: data_inicio (YYYY-MM-DD), data_fim (YYYY-MM-DD), empresa_id (opcional)
      - Retornar: total de vendas, quantidade de orçamentos, ticket médio
      - Agrupar por dia/mês conforme período

   b) vendasPorCliente(req, res):
      - Parâmetros: limite (top N), periodo (opcional)
      - Retornar: ranking de clientes por valor total de orçamentos
      - Incluir: nome cliente, quantidade orçamentos, valor total

   c) vendasPorProduto(req, res):
      - Parâmetros: limite (top N), periodo (opcional)
      - Retornar: ranking de produtos mais vendidos
      - Extrair de json_itens dos orcamentos
      - Incluir: nome produto, quantidade total, valor total

   d) vendasPorStatus(req, res):
      - Retornar: quantidade e valor total agrupado por status
      - Status: Cotação, Aprovado, Separado, Faturado, Cancelado

   e) vendasPorVendedor(req, res):
      - Parâmetros: periodo (opcional)
      - Retornar: vendas agrupadas por usuario_id
      - Incluir: nome usuário, quantidade, valor total

   f) clientesNovos(req, res):
      - Parâmetros: periodo (opcional, padrão: últimos 30 dias)
      - Retornar: quantidade de clientes novos cadastrados por período

   g) produtosMaisVendidos(req, res):
      - Parâmetros: periodo, limite
      - Retornar: produtos mais vendidos com detalhes

   h) resumoGeral(req, res):
      - Retornar dashboard com:
        * Total de clientes
        * Total de produtos
        * Total de orçamentos
        * Total faturado (status = 'Faturado')
        * Orçamentos do mês atual
        * Ticket médio

2. Routes (routes/relatorios.js):
   - Aplicar authMiddleware em todas as rotas
   - Rotas:
     GET /vendas-por-periodo
     GET /vendas-por-cliente
     GET /vendas-por-produto
     GET /vendas-por-status
     GET /vendas-por-vendedor
     GET /clientes-novos
     GET /produtos-mais-vendidos
     GET /resumo-geral

3. Swagger (swagger/relatorios.js):
   - Documentar todos os endpoints
   - Explicar parâmetros de query
   - Exemplos de response

4. app.js:
   - Adicionar: import relatoriosRoutes from "./routes/relatorios.js";
   - Adicionar: app.use("/relatorios", relatoriosRoutes);

5. Funcionalidades obrigatórias:
   - Todos os relatórios devem suportar filtro de período (data_inicio, data_fim)
   - Validação de datas
   - Tratamento de erros
   - Performance: usar índices existentes
   - Formato de resposta padronizado:
     {
       "periodo": { "inicio": "2024-01-01", "fim": "2024-01-31" },
       "dados": [...],
       "totalizadores": {...}
     }

6. Queries SQL otimizadas:
   - Usar índices das tabelas
   - Evitar N+1 queries
   - Agregações eficientes
   - Para json_itens: usar JSON_EXTRACT ou JSON_TABLE (MySQL 8.0+)

ENTREGÁVEIS:
- Criar controllers/relatoriosController.js
- Criar routes/relatorios.js
- Criar swagger/relatorios.js
- Atualizar app.js
- Testar todos os endpoints
- Validar performance das queries

IMPORTANTE:
- Relatórios são apenas leitura (GET)
- Validar parâmetros de data
- Tratar casos de dados vazios
- Formatar números e datas adequadamente
- Considerar timezone se necessário
```

---

## 📋 PROMPT 4: Tabela VEÍCULOS (se necessário)

```
Você é um desenvolvedor backend especializado em Node.js/Express e MySQL.

CONTEXTO:
- Frontend já referencia veiculos em orcamentos
- Veículos pertencem a clientes (cliente_id)

TAREFA:
Criar tabela veiculos se ainda não existir.

ESTRUTURA DA TABELA veiculos:
CREATE TABLE IF NOT EXISTS veiculos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  row_hash CHAR(32) NOT NULL,
  cliente_id INT NOT NULL,
  marca VARCHAR(255) NULL,
  modelo VARCHAR(255) NULL,
  ano VARCHAR(10) NULL,
  placa VARCHAR(10) NULL,
  renavan VARCHAR(50) NULL,
  cor VARCHAR(50) NULL,
  km_atual VARCHAR(20) NULL,
  observacoes TEXT NULL,
  data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_row_hash (row_hash),
  KEY idx_cliente (cliente_id),
  KEY idx_placa (placa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

REQUISITOS:
- Adicionar ao database/setup.sql
- Criar controller, routes e swagger seguindo padrão existente
- Relacionamento com clientes (cliente_id)
- CRUD completo
- Busca e filtros padrão
```

---

## 🚀 Como Usar os Prompts

1. **Copie o prompt completo** do módulo desejado
2. **Cole no Cursor AI** (Ctrl+L ou Cmd+L)
3. **Revise o código gerado** e ajuste se necessário
4. **Teste os endpoints** usando Postman ou Swagger UI
5. **Valide** que segue o padrão do projeto

## ✅ Checklist de Validação

Após implementar cada módulo, verificar:

- [ ] Tabela criada no database/setup.sql
- [ ] Controller criado seguindo padrão baseService
- [ ] Routes criadas com authMiddleware
- [ ] Swagger documentado
- [ ] app.js atualizado com nova rota
- [ ] Endpoints testados
- [ ] Busca geral (q) funcionando
- [ ] Filtros por coluna funcionando
- [ ] Ordenação funcionando
- [ ] Paginação funcionando
- [ ] Autenticação JWT obrigatória

## 📝 Notas Importantes

1. **Orçamentos**: Requer lógica especial para cálculos e numero_sequencial
2. **Relatórios**: Apenas leitura, queries complexas, validar performance
3. **Empresas**: Seguir padrão simples de CRUD
4. **Veículos**: Se não existir, criar seguindo padrão simples

## 🔗 Integração com Frontend

Após implementar no backend, o frontend já está preparado para:
- Empresas: `CompaniesModule.jsx` já existe
- Orçamentos: `QuotesModule.jsx` já existe  
- Relatórios: `ReportsModule.jsx` já existe

Basta atualizar os módulos do frontend para usar a API REST ao invés de Supabase.
