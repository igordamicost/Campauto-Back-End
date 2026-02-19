# Documentação Completa do Sistema - Campauto Backend

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura e Tecnologias](#arquitetura-e-tecnologias)
3. [Regras de Negócio](#regras-de-negócio)
4. [Sistema RBAC (Roles e Permissões)](#sistema-rbac-roles-e-permissões)
5. [Endpoints da API](#endpoints-da-api)
6. [Estrutura de Dados](#estrutura-de-dados)
7. [O que está Implementado](#o-que-está-implementado)
8. [O que Falta Implementar](#o-que-falta-implementar)

---

## 🎯 Visão Geral

Sistema backend para gestão de **Mecânica + Distribuidora de Autopeças** com funcionalidades de:
- Gestão de Clientes, Produtos e Empresas
- Orçamentos
- Sistema de Estoque com Reservas
- Vendas e Comissões
- Relatórios e Notificações
- Autenticação e Autorização (RBAC)
- Integração com Gmail para envio de e-mails

**Tecnologias:** Node.js + Express + MySQL

---

## 🏗️ Arquitetura e Tecnologias

### Stack Tecnológico
- **Runtime:** Node.js (ES Modules)
- **Framework:** Express.js
- **Banco de Dados:** MySQL
- **Autenticação:** JWT (JSON Web Tokens)
- **Documentação:** Swagger/OpenAPI
- **Validação:** Zod
- **Email:** Nodemailer + Gmail API (OAuth2)

### Estrutura de Pastas
```
├── controllers/     # Lógica de negócio
├── routes/         # Definição de rotas
├── swagger/        # Documentação OpenAPI
├── src/
│   ├── config/     # Configurações (DB, Email)
│   ├── middlewares/# Middlewares (Auth, Permissions)
│   ├── repositories/# Camada de acesso a dados
│   ├── services/   # Serviços de negócio
│   ├── seed/       # Seeds iniciais
│   └── templates/  # Templates de email
├── database/
│   └── migrations/ # Migrations SQL
└── server.js       # Entry point
```

---

## 📐 Regras de Negócio

### 1. Autenticação e Usuários

#### Login
- Autenticação via email e senha
- Retorna JWT token para requisições subsequentes
- Token contém: `userId`, `email`, `role`, `permissions`

#### Recuperação de Senha
- Endpoint `/auth/forgot-password` envia email com token único
- Token tem validade limitada
- Rate limiting: máximo de tentativas por IP
- Endpoint `/auth/set-password` permite definir nova senha com token

#### Primeiro Acesso
- Usuários criados recebem email para definir senha
- Senha mínima: 8 caracteres, 1 letra e 1 número
- Token de primeiro acesso tem validade

#### Gestão de Usuários
- Apenas usuários MASTER podem criar novos usuários
- Usuários podem ser bloqueados/desbloqueados
- Cada usuário pode ter um funcionário associado (tabela `employees`)

### 2. Sistema RBAC (Roles e Permissões)

#### Roles Disponíveis
1. **MASTER** - Acesso total ao sistema
2. **ADMIN** - Administrador com acesso amplo (exceto gerenciar usuários)
3. **USER** - Usuário padrão (vendas básicas, reservas)
4. **ALMOX** - Almoxarifado/Estoque (todas operações de estoque)
5. **CONTAB** - Contábil (visualização e exportação)

#### Permissões por Módulo
- **Vendas:** `sales.read`, `sales.create`, `sales.update`, `commissions.read`, `reports.my_sales.read`
- **Oficina:** `service_orders.read/create/update`, `checklists.read/update`
- **Estoque:** `stock.read`, `stock.move`, `stock.reserve.create/update/cancel`, `stock.inventory`
- **Financeiro:** `finance.read/create/update`
- **RH:** `hr.read/create/update`
- **Contábil:** `accounting.read`, `accounting.export`
- **Admin:** `admin.users.manage`, `admin.roles.manage`, `admin.companies.manage`, `admin.templates.manage`, `admin.integrations.manage`

### 3. Gestão de Clientes

- Clientes podem ser pessoas físicas ou jurídicas
- Campos extensos para dados cadastrais completos
- Suporte a múltiplos endereços (residencial, comercial, cobrança)
- Busca avançada por qualquer campo
- Paginação e ordenação customizáveis

### 4. Gestão de Produtos

- Produtos com múltiplos códigos (barras, NCM, CEST, fábrica, referência, original, ANP)
- Hierarquia: Seção → Marca → Linha → Grupo → Subgrupo
- Campo `preco_custo` para controle interno
- Busca por código, descrição ou qualquer campo
- Endpoint `/produtos/correlatos/:id` para produtos relacionados

### 5. Orçamentos

- Orçamentos têm número sequencial único
- Status: `Cotação`, `Aprovado`, `Separado`, `Faturado`, `Cancelado`
- Itens armazenados em JSON (`json_itens`)
- Relacionamento com: Cliente, Empresa, Veículo
- Cálculo automático de subtotal, desconto e total
- Relatórios com KPIs e agregações mensais

### 6. Sistema de Estoque

#### Saldos de Estoque
- Tabela `stock_balances` mantém saldo por produto e localização
- Campos:
  - `qty_on_hand`: Quantidade física disponível
  - `qty_reserved`: Quantidade reservada
  - `qty_available`: Calculado automaticamente (`qty_on_hand - qty_reserved`)

#### Movimentações
- Tipos: `ENTRY` (entrada), `EXIT` (saída), `ADJUSTMENT` (ajuste)
- Movimentações especiais: `RESERVE`, `RESERVE_RETURN`, `RESERVE_CONVERT`
- Cada movimentação registra: quantidade antes/depois, referência (tipo + ID), usuário responsável

#### Localizações
- Suporte a múltiplas localizações (multi-armazém)
- Localização padrão: ID 1 ("Estoque Principal")

#### Regras de Negócio
- Não permite saída (`EXIT`) se quantidade disponível for insuficiente
- Reservas bloqueiam estoque disponível
- Movimentações são auditáveis (histórico completo)

### 7. Sistema de Reservas

#### Criação de Reserva
- Verifica disponibilidade antes de criar
- Bloqueia quantidade no estoque (`qty_reserved` aumenta)
- Status inicial: `ACTIVE`
- Requer: produto, quantidade, data de devolução (`due_at`)

#### Status de Reserva
- `ACTIVE`: Reserva ativa
- `DUE_SOON`: Próxima do vencimento (scheduler atualiza)
- `OVERDUE`: Vencida (scheduler atualiza)
- `RETURNED`: Devolvida ao estoque
- `CANCELED`: Cancelada
- `CONVERTED`: Convertida em venda

#### Devolução
- Endpoint `/reservations/:id/return`
- Libera estoque reservado
- Atualiza `qty_reserved` e cria movimentação `RESERVE_RETURN`

#### Cancelamento
- Endpoint `/reservations/:id/cancel`
- Libera estoque reservado
- Status muda para `CANCELED`

#### Scheduler de Reservas
- Serviço em background verifica reservas próximas do vencimento
- Atualiza status automaticamente (`DUE_SOON`, `OVERDUE`)
- Gera notificações para vendedor e gerentes

### 8. Sistema de Vendas e Comissões

#### Vendas
- Tabela `sales` com status: `PENDING`, `CONFIRMED`, `CANCELED`, `DELIVERED`
- Itens de venda em tabela separada (`sale_items`)
- Itens podem estar vinculados a reservas (`reservation_id`)
- Cálculo de subtotal, desconto e total

#### Comissões
- Calculadas automaticamente por venda
- Campos: `base_amount`, `commission_rate` (%), `commission_amount`
- Status: `PENDING`, `PAID`, `CANCELED`
- Relatórios por vendedor e período (mês)

### 9. Notificações

#### Tipos de Notificação
- `RESERVATION_DUE_SOON`: Reserva próxima do vencimento
- `RESERVATION_OVERDUE`: Reserva vencida
- `RESERVATION_DUE_SOON_MANAGER`: Notificação para gerentes
- `RESERVATION_OVERDUE_MANAGER`: Notificação para gerentes

#### Funcionalidades
- Notificações por usuário
- Marcação como lida
- Filtros por status de leitura
- Metadata com dados adicionais (reservation_id, product_id, etc.)

### 10. Integrações

#### Gmail (OAuth2)
- Configuração via `/integrations/google-mail`
- Requer: `senderEmail`, `clientId`, `clientSecret`, `refreshToken`
- Usado para envio de emails transacionais
- Endpoint de teste disponível

#### Templates de Email
- Templates: `FIRST_ACCESS`, `RESET`
- Edição via API (apenas MASTER)
- Preview com dados mock
- Suporte a variáveis dinâmicas

### 11. Relatórios

#### Relatório de Orçamentos
- Filtros por período e status
- KPIs: total mês atual, total ano atual, ticket médio, quantidade
- Agregações: comparativo mensal, evolução diária

#### Relatório de Vendas
- Por usuário logado (`/reports/my-sales`)
- Filtro por mês (formato YYYY-MM)
- Métricas: total de vendas, valor total, ticket médio, breakdown diário

---

## 🔐 Sistema RBAC (Roles e Permissões)

### Roles e Suas Permissões

#### MASTER (ID: 1)
- **Todas as permissões do sistema**
- Único que pode gerenciar usuários (`admin.users.manage`)

#### ADMIN (ID: 2)
- Todas as permissões exceto `admin.users.manage`
- Pode gerenciar roles, empresas, templates e integrações

#### USER (ID: 3)
- `sales.read`, `sales.create`
- `reports.my_sales.read`
- `commissions.read`
- `stock.read`
- `stock.reserve.create`

#### ALMOX (ID: 4)
- Todas as permissões do módulo `estoque`:
  - `stock.read`, `stock.move`
  - `stock.reserve.create`, `stock.reserve.update`, `stock.reserve.cancel`
  - `stock.inventory`

#### CONTAB (ID: 5)
- `accounting.read`, `accounting.export`
- `finance.read`

### Middleware de Permissões
- `authMiddleware`: Valida JWT e anexa usuário à requisição
- `requirePermission(permission)`: Verifica se usuário tem permissão específica
- `masterOnly`: Apenas usuários MASTER

---

## 🌐 Endpoints da API

### Base URL
```
http://localhost:3000
```

### Autenticação
Todos os endpoints (exceto `/auth/login`, `/auth/forgot-password`, `/health`) requerem header:
```
Authorization: Bearer <token>
```

---

### 🔑 Autenticação (`/auth`)

#### POST `/auth/login`
**Descrição:** Login de usuário

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response 200:**
```json
{
  "token": "jwt_token",
  "user": {
    "id": 1,
    "name": "string",
    "email": "string"
  }
}
```

**Response 401:** Credenciais inválidas

---

#### POST `/auth/forgot-password`
**Descrição:** Envia email de recuperação de senha

**Request Body:**
```json
{
  "email": "cliente@gmail.com"
}
```

**Response 200:** Se o email existir, você receberá instruções

**Rate Limit:** Limitado por IP

---

#### POST `/auth/set-password`
**Descrição:** Define senha com token (primeiro acesso ou recuperação)

**Request Body:**
```json
{
  "token": "string",
  "newPassword": "string" // Mínimo 8 caracteres, 1 letra e 1 número
}
```

**Response 200:** Senha alterada com sucesso

**Response 400:** Token inválido ou senha fraca

---

#### GET `/auth/me`
**Descrição:** Obter dados do usuário logado com permissões

**Headers:** `Authorization: Bearer <token>`

**Response 200:**
```json
{
  "id": 1,
  "name": "string",
  "email": "string",
  "role": {
    "id": 1,
    "name": "MASTER",
    "description": "string"
  },
  "permissions": ["sales.read", "stock.read"],
  "permissionsDetail": [
    {
      "id": 1,
      "key": "sales.read",
      "description": "Visualizar vendas",
      "module": "vendas"
    }
  ]
}
```

---

### 👥 Clientes (`/clientes`)

#### GET `/clientes`
**Descrição:** Lista clientes

**Query Parameters:**
- `page` (integer): Página (default: 1)
- `limit` / `perPage` (integer): Itens por página (default: 10)
- `q` (string): Busca geral por texto
- `sortBy` (string): Coluna para ordenação
- `sortDir` (enum: asc, desc): Direção da ordenação
- `<coluna>` (string): Filtro por qualquer coluna da tabela

**Response 200:**
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 10
}
```

---

#### GET `/clientes/:id`
**Descrição:** Busca cliente por ID

**Response 200:** Cliente encontrado

**Response 404:** Cliente não encontrado

---

#### POST `/clientes`
**Descrição:** Cria cliente

**Request Body:** Objeto com campos do cliente

**Response 201:** Cliente criado

---

#### PUT `/clientes/:id`
**Descrição:** Atualiza cliente

**Request Body:** Objeto com campos a atualizar

**Response 200:** Cliente atualizado

**Response 404:** Cliente não encontrado

---

#### DELETE `/clientes/:id`
**Descrição:** Remove cliente

**Response 200:** Cliente removido

**Response 404:** Cliente não encontrado

---

### 📦 Produtos (`/produtos`)

#### GET `/produtos`
**Descrição:** Lista produtos

**Query Parameters:** Mesmos de `/clientes`

**Response 200:** Lista de produtos paginada

---

#### GET `/produtos/:id`
**Descrição:** Busca produto por ID

**Response 200:** Produto encontrado

**Response 404:** Produto não encontrado

---

#### GET `/produtos/correlatos/:id`
**Descrição:** Busca produtos correlatos

**Response 200:** Lista de produtos relacionados

---

#### POST `/produtos`
**Descrição:** Cria produto

**Request Body:** Objeto com campos do produto

**Response 201:** Produto criado

---

#### PUT `/produtos/:id`
**Descrição:** Atualiza produto

**Request Body:** Objeto com campos a atualizar

**Response 200:** Produto atualizado

---

#### DELETE `/produtos/:id`
**Descrição:** Remove produto

**Response 200:** Produto removido

---

### 🏢 Empresas (`/empresas`)

#### GET `/empresas`
**Descrição:** Lista empresas

**Query Parameters:**
- `page`, `limit`, `perPage`, `q`, `sortBy`, `sortDir`
- `cidade` (string): Filtrar por cidade
- `estado` (string): Filtrar por estado

**Response 200:** Lista de empresas paginada

---

#### GET `/empresas/:id`
**Descrição:** Busca empresa por ID

**Response 200:** Empresa encontrada

---

#### POST `/empresas`
**Descrição:** Cria empresa

**Request Body:**
```json
{
  "nome_fantasia": "string (required)",
  "razao_social": "string",
  "cnpj": "string",
  "endereco": "string",
  "cep": "string",
  "email": "string",
  "cidade": "string",
  "telefone": "string",
  "estado": "string"
}
```

**Response 201:** Empresa criada

---

#### PUT `/empresas/:id`
**Descrição:** Atualiza empresa

**Response 200:** Empresa atualizada

---

#### DELETE `/empresas/:id`
**Descrição:** Remove empresa

**Response 200:** Empresa removida

---

### 💰 Orçamentos (`/orcamentos`)

#### GET `/orcamentos`
**Descrição:** Lista orçamentos

**Query Parameters:**
- `page`, `limit`, `perPage`, `q`, `sortBy`, `sortDir`
- `include` (string): Relacionamentos (ex: "clientes,empresas,veiculos")

**Response 200:** Lista de orçamentos paginada

---

#### GET `/orcamentos/:id`
**Descrição:** Busca orçamento por ID

**Response 200:** Orçamento encontrado

---

#### POST `/orcamentos`
**Descrição:** Cria orçamento

**Request Body:**
```json
{
  "cliente_id": 1, // required
  "empresa_id": 1,
  "veiculo_id": 1,
  "data": "2024-01-01", // required, formato date
  "prazo_entrega": "string",
  "validade": "string",
  "status": "Cotação", // enum: Cotação, Aprovado, Separado, Faturado, Cancelado
  "json_itens": [
    {
      "produto": "string",
      "quantidade": 1.0,
      "unidade": "string",
      "preco_unitario": 10.50,
      "total": 10.50
    }
  ],
  "desconto": 0.00
}
```

**Response 201:** Orçamento criado

---

#### PUT `/orcamentos/:id`
**Descrição:** Atualiza orçamento

**Response 200:** Orçamento atualizado

---

#### PATCH `/orcamentos/:id/status`
**Descrição:** Atualiza status do orçamento

**Request Body:**
```json
{
  "status": "Aprovado" // enum: Cotação, Aprovado, Separado, Faturado, Cancelado
}
```

**Response 200:** Status atualizado

---

#### DELETE `/orcamentos/:id`
**Descrição:** Remove orçamento

**Response 200:** Orçamento removido

---

### 📊 Relatórios (`/relatorios`)

#### GET `/relatorios/orcamentos`
**Descrição:** Relatório de orçamentos com KPIs e agregações

**Query Parameters:**
- `data_inicio` (date): Data inicial (YYYY-MM-DD)
- `data_fim` (date): Data final (YYYY-MM-DD)
- `status` (enum): Filtrar por status

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "numero_sequencial": 1,
      "data": "2024-01-01",
      "status": "Faturado",
      "json_itens": [...],
      "clientes": {
        "id": 1,
        "nome": "string",
        "fantasia": "string"
      }
    }
  ],
  "agregacoes": {
    "comparativo_mensal": [
      {
        "mes": 0,
        "mes_nome": "Janeiro",
        "ano": 2024,
        "total": 1000.00,
        "quantidade": 10
      }
    ],
    "evolucao_diaria": [
      {
        "dia": 1,
        "mes": 1,
        "ano": 2024,
        "data": "2024-01-01",
        "total": 100.00,
        "quantidade": 1
      }
    ],
    "kpis": {
      "total_mes_atual": 1000.00,
      "total_ano_atual": 12000.00,
      "ticket_medio_mes_atual": 100.00,
      "quantidade_mes_atual": 10,
      "mes_atual": 1,
      "ano_atual": 2024
    }
  }
}
```

---

### 👤 Usuários (`/users`)

#### GET `/users`
**Descrição:** Lista usuários

**Query Parameters:**
- `page`, `limit`, `perPage`
- `q` (string): Busca por nome, email ou funcionário
- `role` (enum: MASTER, USER): Filtrar por role
- `blocked` (enum: "0", "1", "true", "false"): Filtrar por bloqueado

**Response 200:** Lista de usuários paginada

---

#### GET `/users/:id`
**Descrição:** Busca usuário por ID

**Response 200:** Usuário encontrado

---

#### POST `/users`
**Descrição:** Cria usuário e funcionário (master only)

**Request Body:**
```json
{
  "name": "string", // required
  "email": "string", // required
  "role": "USER", // enum: MASTER, USER
  "employee": {
    "full_name": "string" // required
  }
}
```

**Response 201:** Usuário criado, e-mail de primeiro acesso enviado

**Response 403:** Apenas master

**Response 409:** E-mail já existe

---

#### PUT `/users/:id`
**Descrição:** Atualiza usuário e funcionário

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "role": "USER",
  "employee": {
    "full_name": "string",
    "phone": "string"
  }
}
```

**Response 200:** Usuário atualizado

---

#### PATCH `/users/:id/block`
**Descrição:** Bloquear ou desbloquear usuário

**Response 200:** Status invertido (bloqueado/desbloqueado)

---

#### POST `/users/:id/reset-password`
**Descrição:** Redefinir senha do usuário

**Request Body:**
```json
{
  "password": "string" // minLength: 6
}
```

**Response 200:** Senha redefinida

---

#### DELETE `/users/:id`
**Descrição:** Remove usuário

**Response 200:** Usuário removido

---

### 🔐 Admin (`/admin`)

**Todas as rotas requerem:** `admin.users.manage` ou `admin.roles.manage`

#### GET `/admin/users`
**Descrição:** Lista usuários (requer `admin.users.manage`)

**Query Parameters:** `page`, `limit`, `q`

**Response 200:** Lista de usuários com paginação

---

#### GET `/admin/users/:id`
**Descrição:** Busca usuário por ID com permissões

**Response 200:** Usuário com permissões detalhadas

---

#### POST `/admin/users`
**Descrição:** Cria usuário (requer `admin.users.manage`)

**Request Body:**
```json
{
  "name": "string", // required
  "email": "string", // required
  "password": "string", // required, minLength: 6
  "role_id": 3, // required (1=MASTER, 2=ADMIN, 3=USER, 4=ALMOX, 5=CONTAB)
  "cpf": "string",
  "telefone": "string"
}
```

**Response 201:** Usuário criado

---

#### PUT `/admin/users/:id`
**Descrição:** Atualiza usuário (requer `admin.users.manage`)

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "role_id": 3,
  "cpf": "string",
  "telefone": "string",
  "blocked": false
}
```

**Response 200:** Usuário atualizado

---

#### DELETE `/admin/users/:id`
**Descrição:** Remove usuário (requer `admin.users.manage`)

**Response 200:** Usuário removido

**Response 400:** Não é possível remover (ex: último admin)

---

#### GET `/admin/roles`
**Descrição:** Lista todas as roles (requer `admin.roles.manage`)

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "MASTER",
      "description": "string"
    }
  ]
}
```

---

#### GET `/admin/permissions`
**Descrição:** Lista todas as permissões (requer `admin.roles.manage`)

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "key": "sales.read",
      "description": "Visualizar vendas",
      "module": "vendas"
    }
  ]
}
```

---

#### GET `/admin/roles/:id/permissions`
**Descrição:** Busca permissões de uma role (requer `admin.roles.manage`)

**Response 200:** Permissões da role

---

#### PUT `/admin/roles/:id/permissions`
**Descrição:** Atualiza permissões de uma role (requer `admin.roles.manage`)

**Request Body:**
```json
{
  "permission_ids": [1, 2, 3, 5, 8] // required
}
```

**Response 200:**
```json
{
  "message": "Permissões atualizadas",
  "role_id": 3,
  "permissions": [...]
}
```

---

### 📦 Estoque (`/stock`)

**Todas as rotas requerem autenticação**

#### GET `/stock/balances`
**Descrição:** Lista saldos de estoque (requer `stock.read`)

**Query Parameters:**
- `productId` (integer): Filtrar por produto
- `locationId` (integer): Filtrar por localização

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "product_id": 1,
      "product_name": "string",
      "product_code": "string",
      "location_id": 1,
      "qty_on_hand": 100.000,
      "qty_reserved": 10.000,
      "qty_available": 90.000
    }
  ]
}
```

---

#### GET `/stock/movements`
**Descrição:** Lista movimentações de estoque (requer `stock.read`)

**Query Parameters:**
- `productId` (integer)
- `locationId` (integer)
- `type` (enum: ENTRY, EXIT, ADJUSTMENT, RESERVE, RESERVE_RETURN, RESERVE_CONVERT)
- `refType` (string): Tipo de referência (ex: PURCHASE, SALE)
- `refId` (integer): ID da referência
- `limit` (integer, default: 100)
- `offset` (integer, default: 0)

**Response 200:**
```json
{
  "data": [...],
  "total": 100
}
```

---

#### POST `/stock/movements`
**Descrição:** Cria movimentação de estoque (requer `stock.move`)

**Request Body:**
```json
{
  "product_id": 1, // required
  "location_id": 1, // default: 1
  "type": "ENTRY", // required, enum: ENTRY, EXIT, ADJUSTMENT
  "qty": 10.000, // required, minimum: 0.001
  "ref_type": "PURCHASE",
  "ref_id": 1,
  "notes": "string"
}
```

**Response 201:**
```json
{
  "id": 1,
  "product_id": 1,
  "product_name": "string",
  "type": "ENTRY",
  "qty": 10.000,
  "qty_before": 90.000,
  "qty_after": 100.000,
  "created_at": "2024-01-01T00:00:00Z"
}
```

**Response 400:** Dados inválidos ou quantidade insuficiente (para EXIT)

---

#### GET `/stock/availability/:productId`
**Descrição:** Verifica disponibilidade de produto (requer `stock.read`)

**Query Parameters:**
- `qty` (number, default: 1): Quantidade desejada
- `locationId` (integer, default: 1): Localização

**Response 200:**
```json
{
  "available": true,
  "qtyAvailable": 90.000,
  "qtyOnHand": 100.000,
  "qtyReserved": 10.000,
  "requested": 1.000
}
```

---

### 📋 Reservas (`/reservations`)

**Todas as rotas requerem autenticação**

#### GET `/reservations`
**Descrição:** Lista reservas (requer `stock.read`)

**Query Parameters:**
- `status` (enum: ACTIVE, DUE_SOON, OVERDUE, RETURNED, CANCELED, CONVERTED)
- `dueFrom` (date-time): Data inicial (ISO datetime)
- `dueTo` (date-time): Data final (ISO datetime)
- `customerId` (integer): Filtrar por cliente
- `productId` (integer): Filtrar por produto
- `salespersonId` (integer): Filtrar por vendedor
- `limit` (integer, default: 50)
- `offset` (integer, default: 0)

**Response 200:**
```json
{
  "data": [...],
  "total": 10
}
```

---

#### GET `/reservations/:id`
**Descrição:** Busca reserva por ID (requer `stock.read`)

**Response 200:** Reserva encontrada

---

#### POST `/reservations`
**Descrição:** Cria reserva (requer `stock.reserve.create`)

**Request Body:**
```json
{
  "product_id": 1, // required
  "customer_id": 1,
  "qty": 5.000, // required, minimum: 0.001
  "due_at": "2024-01-15T23:59:59Z", // required, ISO datetime
  "notes": "string",
  "location_id": 1 // default: 1
}
```

**Response 201:**
```json
{
  "id": 1,
  "product_id": 1,
  "product_name": "string",
  "qty": 5.000,
  "status": "ACTIVE",
  "due_at": "2024-01-15T23:59:59Z"
}
```

**Response 400:** Dados inválidos ou quantidade insuficiente

---

#### PUT `/reservations/:id`
**Descrição:** Atualiza reserva (requer `stock.reserve.update`)

**Request Body:**
```json
{
  "due_at": "2024-01-20T23:59:59Z",
  "notes": "string"
}
```

**Response 200:** Reserva atualizada

---

#### POST `/reservations/:id/return`
**Descrição:** Devolver reserva (requer `stock.reserve.update`)

**Response 200:** Reserva devolvida, estoque liberado

---

#### POST `/reservations/:id/cancel`
**Descrição:** Cancelar reserva (requer `stock.reserve.cancel`)

**Response 200:** Reserva cancelada, estoque liberado

---

### 📊 Relatórios (`/reports`)

#### GET `/reports/my-sales`
**Descrição:** Relatório de vendas do usuário logado (requer `reports.my_sales.read`)

**Query Parameters:**
- `month` (string, required): Mês no formato YYYY-MM (ex: 2026-02)

**Response 200:**
```json
{
  "month": "2026-02",
  "total_sales": 10,
  "total_amount": 1000.00,
  "average_ticket": 100.00,
  "daily_breakdown": [
    {
      "date": "2026-02-01",
      "count": 2,
      "amount": 200.00
    }
  ]
}
```

---

### 💵 Comissões (`/commissions`)

#### GET `/commissions`
**Descrição:** Comissões do usuário logado (requer `commissions.read`)

**Query Parameters:**
- `month` (string, required): Mês no formato YYYY-MM

**Response 200:**
```json
{
  "month": "2026-02",
  "commissions": [
    {
      "id": 1,
      "sale_id": 1,
      "base_amount": 1000.00,
      "commission_rate": 5.00,
      "commission_amount": 50.00,
      "status": "PENDING",
      "paid_at": null,
      "sale_date": "2026-02-01T00:00:00Z",
      "sale_total": 1000.00
    }
  ],
  "summary": {
    "total_commission": 500.00,
    "paid_commission": 200.00,
    "pending_commission": 300.00
  }
}
```

---

#### GET `/commissions/by-salesperson`
**Descrição:** Comissões por vendedor (admin, requer `commissions.read`)

**Query Parameters:**
- `month` (string, required): Mês no formato YYYY-MM
- `salespersonId` (integer): Filtrar por vendedor (opcional)

**Response 200:**
```json
{
  "month": "2026-02",
  "data": [
    {
      "salesperson_user_id": 1,
      "salesperson_name": "string",
      "salesperson_email": "string",
      "total_commissions": 10,
      "total_amount": 500.00,
      "paid_amount": 200.00,
      "pending_amount": 300.00
    }
  ]
}
```

---

### 🔔 Notificações (`/notifications`)

#### GET `/notifications`
**Descrição:** Lista notificações do usuário logado

**Query Parameters:**
- `isRead` (boolean): Filtrar por lidas (true/false)
- `limit` (integer, default: 50)
- `offset` (integer, default: 0)

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "type": "RESERVATION_DUE_SOON",
      "title": "string",
      "message": "string",
      "is_read": false,
      "read_at": null,
      "metadata": {
        "reservation_id": 1,
        "product_id": 1
      },
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 10
}
```

---

#### POST `/notifications/:id/read`
**Descrição:** Marca notificação como lida

**Response 200:**
```json
{
  "message": "Notificação marcada como lida"
}
```

---

### 🔗 Integrações (`/integrations`)

**Todas as rotas requerem:** MASTER

#### POST `/integrations/google-mail`
**Descrição:** Configura integração Gmail (OAuth)

**Request Body:**
```json
{
  "senderEmail": "email@gmail.com", // required
  "clientId": "string", // required
  "clientSecret": "string", // required
  "refreshToken": "string" // required
}
```

**Response 200:** Configuração salva

**Response 403:** Apenas master

---

#### POST `/integrations/google-mail/test`
**Descrição:** Envia e-mail de teste via Gmail API

**Response 200:** E-mail de teste enviado

**Response 500:** Falha ao enviar (integração ou permissões)

---

### 📧 Templates de Email (`/email-templates`)

**Todas as rotas requerem:** MASTER

#### GET `/email-templates`
**Descrição:** Lista templates de e-mail do master

**Response 200:** Lista FIRST_ACCESS e RESET (do banco ou defaults)

---

#### PUT `/email-templates/:templateKey`
**Descrição:** Atualiza template (upsert)

**Path Parameters:**
- `templateKey` (enum: FIRST_ACCESS, RESET)

**Request Body:**
```json
{
  "name": "string", // required
  "subject": "string", // required, maxLength: 160
  "htmlBody": "string", // required
  "isActive": true
}
```

**Response 200:** Template salvo

---

#### POST `/email-templates/:templateKey/preview`
**Descrição:** Preview com dados mock

**Request Body:**
```json
{
  "subject": "string", // required
  "htmlBody": "string" // required
}
```

**Response 200:**
```json
{
  "renderedSubject": "string",
  "renderedHtml": "string"
}
```

---

### ❤️ Health (`/health`)

#### GET `/health`
**Descrição:** Health check da API

**Response 200:**
```json
{
  "status": "ok"
}
```

---

#### GET `/health/email`
**Descrição:** Envia e-mail de teste (SMTP)

**Response 200:** E-mail enviado

**Response 500:** Falha ao enviar

---

## 🗄️ Estrutura de Dados

### Principais Tabelas

#### `users`
- `id`, `name`, `email`, `password`, `role`, `role_id`, `blocked`, `must_set_password`

#### `roles`
- `id`, `name` (MASTER, ADMIN, USER, ALMOX, CONTAB), `description`

#### `permissions`
- `id`, `key` (ex: sales.read), `description`, `module`

#### `role_permissions`
- `role_id`, `permission_id` (tabela de associação)

#### `clientes`
- Campos extensos para dados cadastrais completos (CPF/CNPJ, endereços, contatos, etc.)

#### `produtos`
- `id`, `codigo_produto`, `codigo_barra`, `descricao`, `preco_custo`, campos de hierarquia

#### `empresas`
- `id`, `nome_fantasia`, `razao_social`, `cnpj`, `endereco`, `cidade`, `estado`

#### `orcamentos`
- `id`, `numero_sequencial`, `cliente_id`, `empresa_id`, `veiculo_id`, `data`, `status`, `json_itens`, `subtotal`, `desconto`, `total`

#### `stock_locations`
- `id`, `name`, `code`, `description`, `is_active`

#### `stock_balances`
- `id`, `product_id`, `location_id`, `qty_on_hand`, `qty_reserved`, `qty_available` (calculado)

#### `stock_movements`
- `id`, `product_id`, `location_id`, `type`, `qty`, `qty_before`, `qty_after`, `ref_type`, `ref_id`, `created_by`

#### `reservations`
- `id`, `product_id`, `customer_id`, `salesperson_user_id`, `location_id`, `qty`, `status`, `reserved_at`, `due_at`, `returned_at`

#### `reservation_events`
- `id`, `reservation_id`, `event_type`, `notes`, `created_by`, `created_at`

#### `sales`
- `id`, `customer_id`, `salesperson_user_id`, `total`, `subtotal`, `discount`, `status`

#### `sale_items`
- `id`, `sale_id`, `product_id`, `qty`, `unit_price`, `total`, `reservation_id`

#### `commissions`
- `id`, `sale_id`, `salesperson_user_id`, `base_amount`, `commission_rate`, `commission_amount`, `status`, `paid_at`, `period_month`

#### `notifications`
- `id`, `user_id`, `type`, `title`, `message`, `is_read`, `read_at`, `metadata`, `created_at`

#### `email_templates`
- `id`, `key` (FIRST_ACCESS, RESET), `name`, `subject`, `html_body`, `is_active`

#### `google_mail_integrations`
- `id`, `sender_email`, `client_id`, `client_secret`, `refresh_token`, `is_active`

#### `password_tokens`
- `id`, `user_id`, `token`, `type` (FIRST_ACCESS, RESET), `expires_at`, `used_at`

---

## ✅ O que está Implementado

### Funcionalidades Completas

1. ✅ **Autenticação e Autorização**
   - Login com JWT
   - Recuperação de senha
   - Primeiro acesso com token
   - Sistema RBAC completo
   - Middlewares de permissão

2. ✅ **Gestão de Clientes**
   - CRUD completo
   - Busca avançada
   - Paginação e ordenação

3. ✅ **Gestão de Produtos**
   - CRUD completo
   - Busca avançada
   - Produtos correlatos

4. ✅ **Gestão de Empresas**
   - CRUD completo
   - Filtros por cidade/estado

5. ✅ **Orçamentos**
   - CRUD completo
   - Atualização de status
   - Relacionamentos com clientes, empresas, veículos
   - Relatórios com KPIs e agregações

6. ✅ **Sistema de Estoque**
   - Saldos por produto e localização
   - Movimentações (ENTRY, EXIT, ADJUSTMENT)
   - Verificação de disponibilidade
   - Suporte a múltiplas localizações

7. ✅ **Sistema de Reservas**
   - Criação com verificação de disponibilidade
   - Devolução e cancelamento
   - Scheduler automático para status (DUE_SOON, OVERDUE)
   - Notificações automáticas

8. ✅ **Sistema de Vendas**
   - Estrutura de tabelas criada
   - Relacionamento com reservas

9. ✅ **Sistema de Comissões**
   - Cálculo automático
   - Relatórios por vendedor e período
   - Status (PENDING, PAID, CANCELED)

10. ✅ **Notificações**
    - Criação automática por eventos
    - Marcação como lida
    - Filtros

11. ✅ **Relatórios**
    - Relatório de orçamentos com KPIs
    - Relatório de vendas por usuário
    - Comparativo mensal e evolução diária

12. ✅ **Integrações**
    - Gmail OAuth2
    - Templates de email editáveis
    - Preview de templates

13. ✅ **Admin**
    - Gestão de usuários
    - Gestão de roles e permissões
    - Atribuição de permissões

14. ✅ **Infraestrutura**
    - Migrations automáticas
    - Seeds iniciais
    - Health checks
    - Swagger/OpenAPI

---

## ❌ O que Falta Implementar

### Funcionalidades Pendentes

1. ❌ **Sistema de Vendas (CRUD)**
   - Endpoints para criar/editar/listar vendas
   - Conversão de orçamento em venda
   - Conversão de reserva em venda
   - Atualização automática de estoque ao criar venda
   - Cálculo automático de comissões ao criar venda

2. ❌ **Sistema de Ordens de Serviço**
   - CRUD de ordens de serviço
   - Relacionamento com veículos
   - Status de ordem de serviço
   - Checklists

3. ❌ **Sistema Financeiro**
   - Lançamentos financeiros
   - Contas a pagar/receber
   - Fluxo de caixa
   - Integração com vendas e comissões

4. ❌ **Sistema de RH**
   - Gestão de funcionários
   - Ponto/controle de horas
   - Folha de pagamento

5. ❌ **Sistema Contábil**
   - Exportação de dados contábeis
   - Integração com sistemas externos
   - Relatórios contábeis

6. ❌ **Gestão de Veículos**
   - CRUD de veículos
   - Histórico de serviços
   - Relacionamento com clientes

7. ❌ **Inventário de Estoque**
   - Contagem física
   - Ajustes de inventário
   - Relatórios de divergências

8. ❌ **Relatórios Adicionais**
   - Relatório de estoque
   - Relatório financeiro
   - Relatório de comissões detalhado
   - Dashboard executivo

9. ❌ **Integrações Externas**
   - Integração com sistemas de nota fiscal
   - Integração com sistemas de pagamento
   - Integração com ERPs externos
   - API pública para terceiros

10. ❌ **Melhorias no Sistema de Reservas**
    - Conversão automática de reserva em venda
    - Renovação de reservas
    - Histórico completo de eventos

11. ❌ **Sistema de Notificações**
    - Notificações push (se aplicável)
    - Configuração de preferências de notificação
    - Notificações por email

12. ❌ **Auditoria e Logs**
    - Log de todas as ações críticas
    - Histórico de alterações
    - Rastreabilidade completa

13. ❌ **Validações e Regras de Negócio**
    - Validação de CNPJ/CPF
    - Validação de códigos de barras
    - Regras de desconto por cliente/produto
    - Regras de comissão personalizadas

14. ❌ **Performance e Otimizações**
    - Cache de consultas frequentes
    - Índices adicionais no banco
    - Paginação otimizada
    - Busca full-text

15. ❌ **Testes**
    - Testes unitários
    - Testes de integração
    - Testes end-to-end

16. ❌ **Documentação Adicional**
    - Guia de integração
    - Exemplos de uso
    - Troubleshooting
    - FAQ

---

## 📝 Notas Importantes

### Segurança
- Todas as rotas (exceto login, forgot-password, health) requerem autenticação
- Senhas são hasheadas com bcrypt
- Tokens JWT têm expiração
- Rate limiting em endpoints sensíveis

### Banco de Dados
- Migrations automáticas na inicialização
- Seeds executados automaticamente
- Foreign keys garantem integridade referencial

### Email
- Suporte a SMTP padrão e Gmail OAuth2
- Templates editáveis via API
- Envio assíncrono (recomendado implementar fila)

### Escalabilidade
- Estrutura preparada para múltiplas localizações de estoque
- Sistema de permissões flexível
- Separação de responsabilidades (controllers, repositories, services)

---

## 🔄 Próximos Passos Recomendados

1. **Implementar CRUD completo de Vendas**
   - Criar endpoints `/sales`
   - Integrar com estoque e reservas
   - Calcular comissões automaticamente

2. **Implementar Sistema de Ordens de Serviço**
   - Criar endpoints `/service-orders`
   - Relacionar com veículos e clientes

3. **Melhorar Relatórios**
   - Dashboard executivo
   - Mais KPIs e métricas

4. **Adicionar Validações**
   - Validação de documentos
   - Validação de dados de entrada

5. **Implementar Testes**
   - Cobertura de código crítica
   - Testes de integração

---

**Última atualização:** 2026-02-19
