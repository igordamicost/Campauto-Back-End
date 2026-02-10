# Testes de API - Exemplos cURL e Postman

Este documento contém exemplos de testes para todos os endpoints implementados.

## 🔑 Autenticação

Primeiro, obtenha o token JWT:

```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"master@campauto.com","password":"Master@123"}'

# Response esperado:
# {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
```

Guarde o token para usar nos próximos comandos:
```bash
export TOKEN="seu_token_aqui"
```

---

## 📋 EMPRESAS

### Listar Empresas

```bash
# Lista básica
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/empresas

# Com paginação
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/empresas?page=1&limit=20"

# Com busca geral
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/empresas?q=Campo Grande"

# Com filtros
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/empresas?cidade=Campo Grande&estado=MS"

# Com ordenação
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/empresas?sortBy=nome_fantasia&sortDir=asc"
```

**Response esperado:**
```json
{
  "data": [
    {
      "id": 1,
      "nome_fantasia": "Empresa X",
      "razao_social": "Empresa X LTDA",
      "cnpj": "00.000.000/0001-00",
      "endereco": "Rua A",
      "cep": "79000-000",
      "email": "contato@empresa.com",
      "cidade": "Campo Grande",
      "telefone": "67999999999",
      "estado": "MS"
    }
  ],
  "page": 1,
  "perPage": 10,
  "total": 1,
  "totalPages": 1
}
```

### Buscar Empresa por ID

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/empresas/1
```

### Criar Empresa

```bash
curl -X POST http://localhost:3000/empresas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_fantasia": "Empresa X",
    "razao_social": "Empresa X LTDA",
    "cnpj": "00.000.000/0001-00",
    "endereco": "Rua A, 123",
    "cep": "79000-000",
    "email": "contato@empresa.com",
    "cidade": "Campo Grande",
    "telefone": "67999999999",
    "estado": "MS"
  }'
```

**Response esperado:**
```json
{
  "id": 1
}
```

### Atualizar Empresa

```bash
curl -X PUT http://localhost:3000/empresas/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_fantasia": "Empresa X Atualizada",
    "telefone": "67988888888"
  }'
```

**Response esperado:**
```json
{
  "message": "Updated"
}
```

### Deletar Empresa

```bash
curl -X DELETE http://localhost:3000/empresas/1 \
  -H "Authorization: Bearer $TOKEN"
```

**Response esperado:**
```json
{
  "message": "Deleted"
}
```

---

## 📋 ORÇAMENTOS

### Listar Orçamentos

```bash
# Lista básica
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/orcamentos

# Com relacionamentos (IMPORTANTE para frontend)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/orcamentos?include=clientes,empresas,veiculos"

# Com paginação e relacionamentos
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/orcamentos?page=1&limit=20&include=clientes,empresas,veiculos"

# Com filtro de status
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/orcamentos?status=Cotação&include=clientes"

# Com busca geral
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/orcamentos?q=1001&include=clientes,empresas"
```

**Response esperado (com include):**
```json
{
  "data": [
    {
      "id": 1,
      "numero_sequencial": 1001,
      "cliente_id": 1,
      "empresa_id": 1,
      "veiculo_id": 1,
      "data": "2024-01-15",
      "prazo_entrega": "7 dias",
      "validade": "30 dias",
      "status": "Cotação",
      "observacoes_internas": "Observação interna",
      "json_itens": [
        {
          "produto": "Filtro de Óleo",
          "quantidade": 2,
          "unidade": "PC",
          "preco_unitario": 50.00,
          "total": 100.00
        }
      ],
      "subtotal": 100.00,
      "desconto": 0.00,
      "total": 100.00,
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
  "total": 1,
  "totalPages": 1
}
```

### Buscar Orçamento por ID

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/orcamentos/1
```

**Response**: Mesmo formato do item acima (sempre incluir relacionamentos se existirem)

### Criar Orçamento

```bash
curl -X POST http://localhost:3000/orcamentos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id": 1,
    "empresa_id": 1,
    "veiculo_id": 1,
    "data": "2024-01-15",
    "prazo_entrega": "7 dias",
    "validade": "30 dias",
    "status": "Cotação",
    "observacoes_internas": "Observação interna",
    "json_itens": [
      {
        "produto": "Filtro de Óleo",
        "quantidade": 2,
        "unidade": "PC",
        "preco_unitario": 50.00,
        "total": 100.00
      },
      {
        "produto": "Óleo Motor",
        "quantidade": 1,
        "unidade": "LT",
        "preco_unitario": 80.00,
        "total": 80.00
      }
    ],
    "desconto": 10.00
  }'
```

**Response esperado:**
```json
{
  "id": 1,
  "numero_sequencial": 1001
}
```

**NOTA**: O backend deve:
1. Gerar `numero_sequencial` automaticamente (último + 1)
2. Calcular `subtotal` = 100.00 + 80.00 = 180.00
3. Calcular `total` = 180.00 - 10.00 = 170.00

### Atualizar Orçamento

```bash
curl -X PUT http://localhost:3000/orcamentos/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Aprovado",
    "json_itens": [
      {
        "produto": "Filtro de Óleo",
        "quantidade": 3,
        "unidade": "PC",
        "preco_unitario": 50.00,
        "total": 150.00
      }
    ],
    "desconto": 5.00
  }'
```

**Response esperado:**
```json
{
  "message": "Updated"
}
```

**NOTA**: Backend deve recalcular totais automaticamente

### Atualizar Status do Orçamento

```bash
curl -X PATCH http://localhost:3000/orcamentos/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"Aprovado"}'
```

**Response esperado:**
```json
{
  "message": "Status updated"
}
```

**Status válidos**: `Cotação`, `Aprovado`, `Separado`, `Faturado`, `Cancelado`

### Deletar Orçamento

```bash
curl -X DELETE http://localhost:3000/orcamentos/1 \
  -H "Authorization: Bearer $TOKEN"
```

**Response esperado:**
```json
{
  "message": "Deleted"
}
```

---

## 📊 RELATÓRIOS

### Relatório de Orçamentos

```bash
# Todos os orçamentos
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/relatorios/orcamentos

# Com filtro de período
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/relatorios/orcamentos?data_inicio=2024-01-01&data_fim=2024-12-31"

# Com filtro de status
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/relatorios/orcamentos?status=Cotação"

# Com período e status
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/relatorios/orcamentos?data_inicio=2024-01-01&data_fim=2024-12-31&status=Cotação"
```

**Response esperado:**
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
          "produto": "Filtro de Óleo",
          "quantidade": 2,
          "unidade": "PC",
          "preco_unitario": 50.00,
          "total": 100.00
        }
      ],
      "total": 100.00,
      "clientes": {
        "nome": "João Silva",
        "empresa": "Empresa do João"
      }
    }
  ]
}
```

**NOTA**: Frontend processa esses dados localmente para gerar gráficos e estatísticas.

---

## 🧪 Testes de Validação

### Teste 1: Criar Empresa sem nome_fantasia (deve falhar)

```bash
curl -X POST http://localhost:3000/empresas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"razao_social":"Teste"}'
```

**Response esperado:** `400 Bad Request` com mensagem de erro

### Teste 2: Criar Orçamento sem cliente_id (deve falhar)

```bash
curl -X POST http://localhost:3000/orcamentos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":"2024-01-15","json_itens":[]}'
```

**Response esperado:** `400 Bad Request` com mensagem de erro

### Teste 3: Atualizar Status com valor inválido (deve falhar)

```bash
curl -X PATCH http://localhost:3000/orcamentos/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"StatusInvalido"}'
```

**Response esperado:** `400 Bad Request` com mensagem de erro

### Teste 4: Acesso sem token (deve falhar)

```bash
curl http://localhost:3000/empresas
```

**Response esperado:** `401 Unauthorized`

---

## 📝 Coleção Postman

### Importar no Postman

Crie uma coleção com estas requisições:

1. **Auth**
   - POST `/auth/login`

2. **Empresas**
   - GET `/empresas`
   - GET `/empresas/:id`
   - POST `/empresas`
   - PUT `/empresas/:id`
   - DELETE `/empresas/:id`

3. **Orçamentos**
   - GET `/orcamentos`
   - GET `/orcamentos?include=clientes,empresas,veiculos`
   - GET `/orcamentos/:id`
   - POST `/orcamentos`
   - PUT `/orcamentos/:id`
   - PATCH `/orcamentos/:id/status`
   - DELETE `/orcamentos/:id`

4. **Relatórios**
   - GET `/relatorios/orcamentos`

### Variáveis de Ambiente Postman

```
base_url: http://localhost:3000
token: (preencher após login)
```

### Pre-request Script (para autenticação automática)

```javascript
// Adicionar token automaticamente se existir
if (pm.environment.get("token")) {
    pm.request.headers.add({
        key: "Authorization",
        value: "Bearer " + pm.environment.get("token")
    });
}
```

---

## ✅ Checklist de Testes

- [ ] Login retorna token JWT
- [ ] GET /empresas retorna lista paginada
- [ ] POST /empresas cria empresa e retorna id
- [ ] GET /empresas/:id retorna empresa específica
- [ ] PUT /empresas/:id atualiza empresa
- [ ] DELETE /empresas/:id remove empresa
- [ ] GET /orcamentos retorna lista
- [ ] GET /orcamentos?include=clientes,empresas,veiculos retorna com relacionamentos
- [ ] POST /orcamentos gera numero_sequencial automaticamente
- [ ] POST /orcamentos calcula totais automaticamente
- [ ] PATCH /orcamentos/:id/status atualiza status
- [ ] GET /relatorios/orcamentos retorna dados com clientes
- [ ] Validações funcionam (campos obrigatórios)
- [ ] Autenticação JWT obrigatória em todas as rotas
- [ ] Erros retornam mensagens apropriadas

---

## 🔍 Debug

### Verificar se tabelas existem

```sql
SHOW TABLES LIKE 'empresas';
SHOW TABLES LIKE 'orcamentos';
```

### Verificar estrutura das tabelas

```sql
DESCRIBE empresas;
DESCRIBE orcamentos;
```

### Verificar dados

```sql
SELECT * FROM empresas LIMIT 5;
SELECT * FROM orcamentos LIMIT 5;
```

### Verificar relacionamentos

```sql
SELECT o.*, c.fantasia as cliente_nome 
FROM orcamentos o 
LEFT JOIN clientes c ON o.cliente_id = c.id 
LIMIT 5;
```

---

## 📚 Documentação Swagger

Após implementar, acesse:
```
http://localhost:3000/docs
```

Todos os endpoints devem estar documentados e testáveis via Swagger UI.
