# Resumo de Endpoints da API

## 📊 Tabela Resumida de Endpoints

| Método | Endpoint | Descrição | Autenticação | Módulo |
|--------|----------|-----------|--------------|--------|
| POST | `/auth/login` | Autentica usuário e retorna JWT | ❌ Não | Autenticação |
| POST | `/auth/forgot-password` | Solicita recuperação de senha | ❌ Não | Autenticação |
| POST | `/auth/reset-password` | Redefine senha com token | ❌ Não | Autenticação |
| GET | `/clientes` | Lista clientes (paginado) | ✅ JWT | Clientes |
| GET | `/clientes/:id` | Busca cliente por ID | ✅ JWT | Clientes |
| POST | `/clientes` | Cria novo cliente | ✅ JWT | Clientes |
| PUT | `/clientes/:id` | Atualiza cliente | ✅ JWT | Clientes |
| DELETE | `/clientes/:id` | Remove cliente | ✅ JWT | Clientes |
| GET | `/produtos` | Lista produtos (paginado) | ✅ JWT | Produtos |
| GET | `/produtos/:id` | Busca produto por ID | ✅ JWT | Produtos |
| POST | `/produtos` | Cria novo produto | ✅ JWT | Produtos |
| PUT | `/produtos/:id` | Atualiza produto | ✅ JWT | Produtos |
| DELETE | `/produtos/:id` | Remove produto | ✅ JWT | Produtos |
| POST | `/users` | Cria usuário e funcionário | ✅ JWT | Usuários |
| GET | `/health` | Health check da API | ❌ Não | Health |
| GET | `/docs` | Documentação Swagger UI | ❌ Não | Documentação |

---

## 🔐 Endpoints Protegidos por JWT

### Total: **11 endpoints protegidos**

#### Clientes (5 endpoints)
- `GET /clientes` - Listagem paginada
- `GET /clientes/:id` - Busca por ID
- `POST /clientes` - Criação
- `PUT /clientes/:id` - Atualização
- `DELETE /clientes/:id` - Exclusão

#### Produtos (5 endpoints)
- `GET /produtos` - Listagem paginada
- `GET /produtos/:id` - Busca por ID
- `POST /produtos` - Criação
- `PUT /produtos/:id` - Atualização
- `DELETE /produtos/:id` - Exclusão

#### Usuários (1 endpoint)
- `POST /users` - Criação de usuário e funcionário

### Formato de Autenticação:
```
Authorization: Bearer <token_jwt>
```

### Endpoints Públicos (5):
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /health`
- `GET /docs`

---

## 📋 Detalhes por Módulo

### 🔐 Autenticação (3 endpoints públicos)
| Endpoint | Método | Body | Resposta |
|----------|--------|------|----------|
| `/auth/login` | POST | `{email, password}` | `{token}` |
| `/auth/forgot-password` | POST | `{email}` | `{message}` |
| `/auth/reset-password` | POST | `{token, password}` | `{message}` |

### 👥 Clientes (5 endpoints protegidos)
| Endpoint | Método | Query/Path | Body | Resposta |
|----------|--------|------------|------|----------|
| `/clientes` | GET | `?page=1&limit=10` | - | `{data, page, perPage, total, totalPages}` |
| `/clientes/:id` | GET | `:id` | - | `{...cliente}` |
| `/clientes` | POST | - | `{nome, empresa, ...}` | `{id}` |
| `/clientes/:id` | PUT | `:id` | `{campos}` | `{message}` |
| `/clientes/:id` | DELETE | `:id` | - | `{message}` |

### 📦 Produtos (5 endpoints protegidos)
| Endpoint | Método | Query/Path | Body | Resposta |
|----------|--------|------------|------|----------|
| `/produtos` | GET | `?page=1&limit=10` | - | `{data, page, perPage, total, totalPages}` |
| `/produtos/:id` | GET | `:id` | - | `{...produto}` |
| `/produtos` | POST | - | `{nome, tipo, valor_unitario, ...}` | `{id}` |
| `/produtos/:id` | PUT | `:id` | `{campos}` | `{message}` |
| `/produtos/:id` | DELETE | `:id` | - | `{message}` |

### 👤 Usuários (1 endpoint protegido)
| Endpoint | Método | Body | Resposta |
|----------|--------|------|----------|
| `/users` | POST | `{name, email, password, role?, employee: {full_name, phone?}}` | `{id}` |

### 🏥 Health (1 endpoint público)
| Endpoint | Método | Resposta |
|----------|--------|----------|
| `/health` | GET | `{status: "ok"}` |

---

## ⚠️ Códigos de Status HTTP

### Sucesso
- `200 OK` - Operação bem-sucedida
- `201 Created` - Recurso criado com sucesso

### Erro do Cliente
- `400 Bad Request` - Dados inválidos ou campos obrigatórios ausentes
- `401 Unauthorized` - Token ausente, inválido ou expirado
- `404 Not Found` - Recurso não encontrado
- `409 Conflict` - Conflito (ex: email duplicado)

### Erro do Servidor
- `500 Internal Server Error` - Erro interno do servidor

---

## 🔑 Fluxo de Autenticação

1. **Login**: `POST /auth/login` com `{email, password}`
2. **Receber Token**: Resposta `{token: "jwt_token"}`
3. **Usar Token**: Incluir no header `Authorization: Bearer <token>`
4. **Acessar Endpoints Protegidos**: Todos os endpoints de clientes, produtos e usuários

### Validade do Token
- O token JWT não possui expiração explícita configurada no código atual
- O token contém `{userId: <id>}` no payload
