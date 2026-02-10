# Comandos cURL - Testes Rápidos

## 🔑 Obter Token

```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"master@campauto.com","password":"Master@123"}'

# Salvar token em variável (Linux/Mac)
export TOKEN="cole_o_token_aqui"

# Windows PowerShell
$TOKEN = "cole_o_token_aqui"
```

---

## 📋 EMPRESAS

### Listar
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/empresas
```

### Criar
```bash
curl -X POST http://localhost:3000/empresas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_fantasia":"Empresa X",
    "razao_social":"Empresa X LTDA",
    "cnpj":"00.000.000/0001-00",
    "endereco":"Rua A",
    "cep":"79000-000",
    "email":"contato@empresa.com",
    "cidade":"Campo Grande",
    "telefone":"67999999999",
    "estado":"MS"
  }'
```

### Buscar por ID
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/empresas/1
```

### Atualizar
```bash
curl -X PUT http://localhost:3000/empresas/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nome_fantasia":"Empresa X Atualizada"}'
```

### Deletar
```bash
curl -X DELETE http://localhost:3000/empresas/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📋 ORÇAMENTOS

### Listar (sem relacionamentos)
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/orcamentos
```

### Listar (COM relacionamentos - IMPORTANTE para frontend)
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/orcamentos?include=clientes,empresas,veiculos"
```

### Criar
```bash
curl -X POST http://localhost:3000/orcamentos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id":1,
    "empresa_id":1,
    "data":"2024-01-15",
    "status":"Cotação",
    "json_itens":[
      {
        "produto":"Filtro",
        "quantidade":2,
        "unidade":"PC",
        "preco_unitario":50,
        "total":100
      }
    ],
    "desconto":0
  }'
```

**Response esperado:**
```json
{
  "id": 1,
  "numero_sequencial": 1001
}
```

### Buscar por ID
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/orcamentos/1
```

### Atualizar Status
```bash
curl -X PATCH http://localhost:3000/orcamentos/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"Aprovado"}'
```

### Atualizar Orçamento Completo
```bash
curl -X PUT http://localhost:3000/orcamentos/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id":1,
    "empresa_id":1,
    "data":"2024-01-15",
    "status":"Aprovado",
    "json_itens":[
      {
        "produto":"Filtro",
        "quantidade":3,
        "unidade":"PC",
        "preco_unitario":50,
        "total":150
      }
    ],
    "desconto":10
  }'
```

### Deletar
```bash
curl -X DELETE http://localhost:3000/orcamentos/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 RELATÓRIOS

### Relatório de Orçamentos
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/relatorios/orcamentos?data_inicio=2024-01-01&data_fim=2024-12-31&status=Cotação"
```

### Todos os Orçamentos (para relatórios)
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/relatorios/orcamentos
```

---

## 🧪 Testes de Validação

### Teste: Empresa sem nome_fantasia (deve retornar erro)
```bash
curl -X POST http://localhost:3000/empresas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"razao_social":"Teste"}'
```

### Teste: Orçamento sem cliente_id (deve retornar erro)
```bash
curl -X POST http://localhost:3000/orcamentos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":"2024-01-15"}'
```

### Teste: Status inválido (deve retornar erro)
```bash
curl -X PATCH http://localhost:3000/orcamentos/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"StatusInvalido"}'
```

### Teste: Sem autenticação (deve retornar 401)
```bash
curl http://localhost:3000/empresas
```

---

## 📝 Notas Importantes

1. **Token JWT**: Substitua `$TOKEN` pelo token real obtido no login
2. **Include**: Para orçamentos, sempre use `include=clientes,empresas,veiculos` quando o frontend precisar dos relacionamentos
3. **json_itens**: Deve ser um array JSON válido
4. **numero_sequencial**: É gerado automaticamente pelo backend
5. **Totais**: São calculados automaticamente pelo backend (subtotal, desconto, total)

---

## 🔍 Verificar Respostas

### Formato esperado de resposta (GET /orcamentos com include):
```json
{
  "data": [
    {
      "id": 1,
      "numero_sequencial": 1001,
      "cliente_id": 1,
      "empresa_id": 1,
      "data": "2024-01-15",
      "status": "Cotação",
      "json_itens": [
        {
          "produto": "Filtro",
          "quantidade": 2,
          "unidade": "PC",
          "preco_unitario": 50,
          "total": 100
        }
      ],
      "subtotal": 100.00,
      "desconto": 0.00,
      "total": 100.00,
      "clientes": {
        "nome": "João Silva",
        "empresa": "Empresa do João"
      },
      "empresas": {
        "nome_fantasia": "Minha Empresa"
      },
      "veiculos": {
        "marca": "Toyota",
        "modelo": "Corolla",
        "placa": "ABC-1234"
      }
    }
  ],
  "page": 1,
  "perPage": 10,
  "total": 1,
  "totalPages": 1
}
```

---

## ✅ Validações que o Backend Deve Fazer

- ✅ `nome_fantasia` obrigatório em POST /empresas
- ✅ `cliente_id` obrigatório em POST /orcamentos
- ✅ `data` obrigatório em POST /orcamentos
- ✅ `status` deve ser um dos valores válidos
- ✅ `numero_sequencial` único e auto-incrementar
- ✅ Calcular `subtotal` e `total` automaticamente
- ✅ Validar `json_itens` é array válido
- ✅ Autenticação JWT em todas as rotas
