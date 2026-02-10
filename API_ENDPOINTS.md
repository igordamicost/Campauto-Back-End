# Mapeamento de Endpoints da API

## 📋 Índice
1. [Autenticação](#autenticação)
2. [Clientes](#clientes)
3. [Produtos](#produtos)
4. [Usuários](#usuários)
5. [Health/Diagnóstico](#healthdiagnóstico)
6. [Documentação](#documentação)
7. [Resumo de Endpoints Protegidos](#resumo-de-endpoints-protegidos)

---

## 🔐 Autenticação

### POST `/auth/login`
**Descrição:** Autentica um usuário e retorna um token JWT

**Autenticação:** Não requerida

**Body:**
```json
{
  "email": "string (obrigatório)",
  "password": "string (obrigatório)"
}
```

**Respostas:**
- `200 OK`: Token JWT gerado com sucesso
  ```json
  {
    "token": "string"
  }
  ```
- `400 Bad Request`: Campos obrigatórios ausentes
  ```json
  {
    "message": "Email and password required"
  }
  ```
- `401 Unauthorized`: Credenciais inválidas
  ```json
  {
    "message": "Invalid credentials"
  }
  ```

---

### POST `/auth/forgot-password`
**Descrição:** Envia email de recuperação de senha (se o email existir)

**Autenticação:** Não requerida

**Body:**
```json
{
  "email": "string (obrigatório)"
}
```

**Respostas:**
- `200 OK`: Mensagem de confirmação (sempre retorna sucesso por segurança)
  ```json
  {
    "message": "Se o email existir, você receberá instruções"
  }
  ```

**Nota:** Este endpoint sempre retorna sucesso para não expor se um email existe ou não no sistema.

---

### POST `/auth/reset-password`
**Descrição:** Redefine a senha do usuário usando um token de reset

**Autenticação:** Não requerida (usa token de reset no body)

**Body:**
```json
{
  "token": "string (obrigatório)",
  "password": "string (obrigatório)"
}
```

**Respostas:**
- `200 OK`: Senha alterada com sucesso
  ```json
  {
    "message": "Senha alterada com sucesso"
  }
  ```
- `400 Bad Request`: Token inválido ou expirado

---

## 👥 Clientes

Todos os endpoints de clientes requerem autenticação JWT.

### GET `/clientes`
**Descrição:** Lista todos os clientes com paginação

**Autenticação:** JWT (Bearer Token)

**Parâmetros Query:**
- `page` (opcional, padrão: 1): Número da página
- `limit` ou `perPage` (opcional, padrão: 10): Itens por página

**Exemplo:** `/clientes?page=1&limit=20`

**Respostas:**
- `200 OK`: Lista paginada de clientes
  ```json
  {
    "data": [
      {
        "id": "integer",
        "nome": "string",
        "empresa": "string",
        "...": "outros campos da tabela clientes"
      }
    ],
    "page": 1,
    "perPage": 10,
    "total": 100,
    "totalPages": 10
  }
  ```
- `401 Unauthorized`: Token ausente ou inválido

---

### GET `/clientes/:id`
**Descrição:** Busca um cliente específico por ID

**Autenticação:** JWT (Bearer Token)

**Parâmetros Path:**
- `id` (obrigatório): ID do cliente (integer)

**Respostas:**
- `200 OK`: Cliente encontrado
  ```json
  {
    "id": "integer",
    "nome": "string",
    "empresa": "string",
    "...": "todos os campos do cliente"
  }
  ```
- `404 Not Found`: Cliente não encontrado
  ```json
  {
    "message": "Not found"
  }
  ```
- `401 Unauthorized`: Token ausente ou inválido

---

### POST `/clientes`
**Descrição:** Cria um novo cliente

**Autenticação:** JWT (Bearer Token)

**Body:**
```json
{
  "nome": "string",
  "empresa": "string",
  "...": "campos da tabela clientes (exceto id e row_hash)"
}
```

**Respostas:**
- `201 Created`: Cliente criado com sucesso
  ```json
  {
    "id": "integer"
  }
  ```
- `409 Conflict`: Dados duplicados ou inválidos
  ```json
  {
    "message": "Duplicate or invalid"
  }
  ```
- `401 Unauthorized`: Token ausente ou inválido

---

### PUT `/clientes/:id`
**Descrição:** Atualiza um cliente existente

**Autenticação:** JWT (Bearer Token)

**Parâmetros Path:**
- `id` (obrigatório): ID do cliente (integer)

**Body:**
```json
{
  "nome": "string",
  "empresa": "string",
  "...": "campos a serem atualizados"
}
```

**Respostas:**
- `200 OK`: Cliente atualizado
  ```json
  {
    "message": "Updated"
  }
  ```
- `404 Not Found`: Cliente não encontrado ou body vazio
  ```json
  {
    "message": "Not found or empty body"
  }
  ```
- `401 Unauthorized`: Token ausente ou inválido

---

### DELETE `/clientes/:id`
**Descrição:** Remove um cliente

**Autenticação:** JWT (Bearer Token)

**Parâmetros Path:**
- `id` (obrigatório): ID do cliente (integer)

**Respostas:**
- `200 OK`: Cliente removido
  ```json
  {
    "message": "Deleted"
  }
  ```
- `404 Not Found`: Cliente não encontrado
  ```json
  {
    "message": "Not found"
  }
  ```
- `401 Unauthorized`: Token ausente ou inválido

---

## 📦 Produtos

Todos os endpoints de produtos requerem autenticação JWT.

### GET `/produtos`
**Descrição:** Lista todos os produtos com paginação

**Autenticação:** JWT (Bearer Token)

**Parâmetros Query:**
- `page` (opcional, padrão: 1): Número da página
- `limit` ou `perPage` (opcional, padrão: 10): Itens por página

**Exemplo:** `/produtos?page=2&perPage=25`

**Respostas:**
- `200 OK`: Lista paginada de produtos
  ```json
  {
    "data": [
      {
        "id": "integer",
        "nome": "string",
        "tipo": "string",
        "valor_unitario": "decimal",
        "...": "outros campos da tabela produtos"
      }
    ],
    "page": 1,
    "perPage": 10,
    "total": 50,
    "totalPages": 5
  }
  ```
- `401 Unauthorized`: Token ausente ou inválido

---

### GET `/produtos/:id`
**Descrição:** Busca um produto específico por ID

**Autenticação:** JWT (Bearer Token)

**Parâmetros Path:**
- `id` (obrigatório): ID do produto (integer)

**Respostas:**
- `200 OK`: Produto encontrado
  ```json
  {
    "id": "integer",
    "nome": "string",
    "tipo": "string",
    "valor_unitario": "decimal",
    "...": "todos os campos do produto"
  }
  ```
- `404 Not Found`: Produto não encontrado
  ```json
  {
    "message": "Not found"
  }
  ```
- `401 Unauthorized`: Token ausente ou inválido

---

### POST `/produtos`
**Descrição:** Cria um novo produto

**Autenticação:** JWT (Bearer Token)

**Body:**
```json
{
  "nome": "string",
  "tipo": "string",
  "valor_unitario": "decimal",
  "...": "campos da tabela produtos (exceto id e row_hash)"
}
```

**Respostas:**
- `201 Created`: Produto criado com sucesso
  ```json
  {
    "id": "integer"
  }
  ```
- `409 Conflict`: Dados duplicados ou inválidos
  ```json
  {
    "message": "Duplicate or invalid"
  }
  ```
- `401 Unauthorized`: Token ausente ou inválido

---

### PUT `/produtos/:id`
**Descrição:** Atualiza um produto existente

**Autenticação:** JWT (Bearer Token)

**Parâmetros Path:**
- `id` (obrigatório): ID do produto (integer)

**Body:**
```json
{
  "nome": "string",
  "valor_unitario": "decimal",
  "...": "campos a serem atualizados"
}
```

**Respostas:**
- `200 OK`: Produto atualizado
  ```json
  {
    "message": "Updated"
  }
  ```
- `404 Not Found`: Produto não encontrado ou body vazio
  ```json
  {
    "message": "Not found or empty body"
  }
  ```
- `401 Unauthorized`: Token ausente ou inválido

---

### DELETE `/produtos/:id`
**Descrição:** Remove um produto

**Autenticação:** JWT (Bearer Token)

**Parâmetros Path:**
- `id` (obrigatório): ID do produto (integer)

**Respostas:**
- `200 OK`: Produto removido
  ```json
  {
    "message": "Deleted"
  }
  ```
- `404 Not Found`: Produto não encontrado
  ```json
  {
    "message": "Not found"
  }
  ```
- `401 Unauthorized`: Token ausente ou inválido

---

## 👤 Usuários

Todos os endpoints de usuários requerem autenticação JWT.

### POST `/users`
**Descrição:** Cria um novo usuário e funcionário associado

**Autenticação:** JWT (Bearer Token)

**Body:**
```json
{
  "name": "string (obrigatório)",
  "email": "string (obrigatório)",
  "password": "string (obrigatório)",
  "role": "string (opcional, padrão: 'USER', valores: 'MASTER' | 'USER')",
  "employee": {
    "full_name": "string (obrigatório)",
    "phone": "string (opcional)"
  }
}
```

**Respostas:**
- `201 Created`: Usuário criado com sucesso
  ```json
  {
    "id": "integer"
  }
  ```
- `400 Bad Request`: Campos obrigatórios ausentes
  ```json
  {
    "message": "Missing required fields"
  }
  ```
- `409 Conflict`: Email já existe
  ```json
  {
    "message": "Email already exists"
  }
  ```
- `401 Unauthorized`: Token ausente ou inválido

**Nota:** Este endpoint cria tanto o registro na tabela `users` quanto na tabela `employees` em uma transação. Também envia um email de boas-vindas com as credenciais.

---

## 🏥 Health/Diagnóstico

### GET `/health`
**Descrição:** Verifica o status da API

**Autenticação:** Não requerida

**Respostas:**
- `200 OK`: API está funcionando
  ```json
  {
    "status": "ok"
  }
  ```

---

## 📚 Documentação

### GET `/docs`
**Descrição:** Interface Swagger UI para documentação interativa da API

**Autenticação:** Não requerida

**Acesso:** Navegador web - interface gráfica Swagger UI

**URL Base:** `http://localhost:3000/docs`

---

## 🔒 Resumo de Endpoints Protegidos

### Endpoints que **NÃO** requerem autenticação:
1. `POST /auth/login` - Login de usuário
2. `POST /auth/forgot-password` - Recuperação de senha
3. `POST /auth/reset-password` - Reset de senha
4. `GET /health` - Health check
5. `GET /docs` - Documentação Swagger

### Endpoints que **REQUEREM** autenticação JWT (Bearer Token):

#### Clientes (5 endpoints):
- `GET /clientes` - Listar clientes
- `GET /clientes/:id` - Buscar cliente por ID
- `POST /clientes` - Criar cliente
- `PUT /clientes/:id` - Atualizar cliente
- `DELETE /clientes/:id` - Deletar cliente

#### Produtos (5 endpoints):
- `GET /produtos` - Listar produtos
- `GET /produtos/:id` - Buscar produto por ID
- `POST /produtos` - Criar produto
- `PUT /produtos/:id` - Atualizar produto
- `DELETE /produtos/:id` - Deletar produto

#### Usuários (1 endpoint):
- `POST /users` - Criar usuário e funcionário

### Total de Endpoints:
- **Públicos:** 5 endpoints
- **Protegidos:** 11 endpoints
- **Total:** 16 endpoints

### Formato de Autenticação:
Todos os endpoints protegidos requerem o header:
```
Authorization: Bearer <token_jwt>
```

O token JWT é obtido através do endpoint `POST /auth/login` e contém o `userId` no payload.

### Tratamento de Erros de Autenticação:
- `401 Unauthorized`: Retornado quando:
  - Token ausente no header `Authorization`
  - Token inválido ou malformado
  - Token expirado
  - Formato incorreto (deve ser `Bearer <token>`)

**Mensagem de erro padrão:**
```json
{
  "message": "Token inválido ou ausente"
}
```
ou
```json
{
  "message": "Token inválido ou expirado"
}
```

---

## 📝 Notas Técnicas

### Paginação:
- Os endpoints de listagem (`GET /clientes` e `GET /produtos`) suportam paginação
- Parâmetros: `page` (padrão: 1) e `limit`/`perPage` (padrão: 10)
- Resposta inclui: `data`, `page`, `perPage`, `total`, `totalPages`

### Validação de Dados:
- Endpoints de criação e atualização validam campos obrigatórios
- Campos `id` e `row_hash` são gerenciados automaticamente pelo sistema
- Duplicatas são detectadas através do hash MD5 dos dados

### Transações:
- O endpoint `POST /users` usa transações para garantir consistência entre `users` e `employees`

### Hash de Senha:
- Senhas são armazenadas usando SHA-256 (legado) ou bcrypt (novos usuários)
- O sistema suporta ambos os formatos para compatibilidade
