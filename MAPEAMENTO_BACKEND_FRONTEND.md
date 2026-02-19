# Mapeamento Backend ↔ Frontend

Documento de alinhamento entre o mapeamento de regras do frontend e o estado atual do backend.  
**Baseado no documento do frontend (19/02/2026)** — NF-e deixada de lado conforme combinado.

---

## 1. Autenticação (`/auth`)

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `/auth/login` | POST | ✅ | Body: `{ email, password }`. Retorna `{ token }`. 401: "E-mail ou senha incorretos". |
| `/auth/me` | GET | ✅ | Retorna `{ id, name, email, role: { id, name, description }, permissions, permissionsDetail }`. JWT obrigatório. |
| `/auth/forgot-password` | POST | ✅ | Body: `{ email }`. Sem auth. |
| `/auth/reset-password` | POST | ✅ | Body: `{ token, password }`. Sem auth. |
| `/auth/set-password` | POST | ✅ | Body: `{ token, newPassword }`. Sem auth. |

---

## 2. Clientes (`/clientes`)

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `GET /clientes` | GET | ✅ | Query: `q`, `page`, `limit`, `sortBy`, `sortDir`, `municipio`, `uf`, `tipo_pessoa`, `status`. Resposta paginada. Busca inteligente em fantasia, razao_social, telefone, celular, email, municipio. Ordenação: PJ primeiro, depois PF. |
| `GET /clientes/:id` | GET | ✅ | Objeto cliente completo. |
| `POST /clientes` | POST | ✅ | Body conforme DTO (baseService). |
| `PUT /clientes/:id` | PUT | ✅ | |
| `DELETE /clientes/:id` | DELETE | ✅ | (Sem validação de orçamento/pedido vinculado ainda — definir regra.) |

---

## 3. Veículos

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `GET /veiculos?cliente_id=:id` | GET | ✅ | Lista veículos do cliente. Query: `cliente_id`, `q`, `page`, `limit`. |
| `GET /veiculos/:id` | GET | ✅ | Veículo por ID. |
| `POST /veiculos` | POST | ✅ | Body: `{ cliente_id, marca, modelo?, placa?, ano?, renavan? }`. Pelo menos marca ou placa. |
| `PUT /veiculos/:id` | PUT | ✅ | |
| `DELETE /veiculos/:id` | DELETE | ✅ | Bloqueia se veículo estiver em orçamento. |

**Nota:** Front pode usar `GET /veiculos?cliente_id=X` em vez de `GET /clientes/:clienteId/veiculos`.

---

## 4. Empresas (`/empresas`)

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `GET /empresas` | GET | ✅ | Listagem paginada, filtros. |
| `GET /empresas/:id` | GET | ✅ | |
| `POST /empresas` | POST | ✅ | |
| `PUT /empresas/:id` | PUT | ✅ | |
| `DELETE /empresas/:id` | DELETE | ✅ | |

---

## 5. Produtos (`/produtos`)

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `GET /produtos` | GET | ✅ | Query: `page`, `limit`, `q`, `sortBy`, `sortDir`, filtros. |
| `GET /produtos/:id` | GET | ✅ | |
| `POST /produtos` | POST | ✅ | |
| `PUT /produtos/:id` | PUT | ✅ | Inclui atualização de preço. |
| `DELETE /produtos/:id` | DELETE | ✅ | |
| `GET /produtos/correlatos/:id` | GET | ✅ | Produtos correlatos (mesma observação). |

---

## 6. Orçamentos (`/orcamentos`)

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `GET /orcamentos` | GET | ✅ | Query: `include=clientes,empresas,veiculos,usuario`, paginação, filtros. |
| `GET /orcamentos/:id` | GET | ✅ | Com relacionamentos e `json_itens`. |
| `POST /orcamentos` | POST | ✅ | Payload: cliente_id, empresa_id, veiculo_id, data, status, json_itens, etc. |
| `PUT /orcamentos/:id` | PUT | ✅ | |
| `PATCH /orcamentos/:id/status` | PATCH | ✅ | Body: `{ status }`. Status: Cotação, Aprovado, Separado, Faturado, Cancelado. |
| `DELETE /orcamentos/:id` | DELETE | ✅ | (Definir regra: apenas Cotação/Cancelado?) |

---

## 7. Relatórios (`/relatorios`)

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `GET /relatorios/orcamentos` | GET | ✅ | Query: `data_inicio`, `data_fim`, `status`, `include`. Retorna lista + agregacoes. |

---

## 8. Usuários e Admin

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `GET /users` | GET | ✅ | Listagem com permissão. |
| `GET /users/:id` | GET | ✅ | |
| `POST /users` | POST | ✅ | (masterOnly ou permissão.) |
| `PUT /users/:id` | PUT | ✅ | |
| `DELETE /users/:id` | DELETE | ✅ | |
| `PATCH /users/:id/block` | PATCH | ✅ | Body: `{ blocked }`. |
| `POST /users/:id/reset-password` | POST | ✅ | Resetar senha do usuário (admin). |
| `GET /admin/users` | GET | ✅ | |
| `GET /admin/users/:id` | GET | ✅ | |
| `POST /admin/users` | POST | ✅ | |
| `PUT /admin/users/:id` | PUT | ✅ | |
| `DELETE /admin/users/:id` | DELETE | ✅ | |
| `GET /admin/roles` | GET | ✅ | |
| `GET /admin/roles/:id` | GET | ✅ | |
| `POST /admin/roles` | POST | ✅ | |
| `PUT /admin/roles/:id` | PUT | ✅ | |
| `GET /admin/permissions` | GET | ✅ | |
| `GET /admin/roles/:id/permissions` | GET | ✅ | |
| `PUT /admin/roles/:id/permissions` | PUT | ✅ | Body: `{ permission_ids }`. |

---

## 9. Integrações Gmail

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `POST /integrations/google-mail` | POST | ✅ | Body: senderEmail, clientId, clientSecret, refreshToken. Auth + masterOnly. |
| `POST /integrations/google-mail/test` | POST | ✅ | |
| `POST /integrations/google-mail/exchange-code` | POST | ✅ | Body: code, redirectUri, clientId, clientSecret. Retorna `{ refreshToken, senderEmail? }`. |

---

## 10. Templates de e-mail

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `GET /email-templates` | GET | ✅ | Listar templates (chaves ex.: FIRST_ACCESS, RESET). |
| `PUT /email-templates/:templateKey` | PUT | ✅ | name, subject, htmlBody, isActive. |
| `POST /email-templates/:templateKey/preview` | POST | ✅ | Retorna `{ subject, htmlBody }`. |

---

## 11. Estoque e reservas (opcional)

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `GET /stock/balances` | GET | ✅ | |
| `GET /stock/movements` | GET | ✅ | |
| `POST /stock/movements` | POST | ✅ | |
| `GET /stock/availability/:productId` | GET | ✅ | |
| `GET/POST/PUT /reservations` | GET/POST/PUT | ✅ | |
| `POST /reservations/:id/return` | POST | ✅ | |
| `POST /reservations/:id/cancel` | POST | ✅ | |

---

## 12. Oficina (OS)

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `GET /oficina/os` | GET | ✅ | Stub: retorna lista vazia. Query: `q`. |
| `GET /oficina/os/:id` | GET | ✅ | Stub: 404. |
| `GET /oficina/os/:osId/checklists` | GET | ✅ | Stub: retorna `{ data: [] }`. |

Status de OS no front: ABERTA, EM_ANDAMENTO, AGUARDANDO_PECAS, FINALIZADA, CANCELADA. Implementação futura.

---

## 13. Comissões e desempenho

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `GET /commissions` | GET | ✅ | Query: `month` (YYYY-MM). Usuário logado. |
| `GET /commissions/by-salesperson` | GET | ✅ | Query: `month`, `salespersonId`. Admin. |
| `GET /reports/my-sales` | GET | ✅ | Query: `month`. |

---

## 14. Pessoas / RH

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `GET /pessoas/funcionarios` | GET | ✅ | Lista users + employees (full_name, phone). Query: page, limit, q. |

---

## 15. Fiscal (sem NF-e)

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `GET /fiscal/exportacoes` | GET | ✅ | Stub: retorna lista vazia. NF-e à parte. |

---

## 16. Notificações

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `GET /notifications` | GET | ✅ | Query: isRead, limit, offset. |
| `POST /notifications/:id/read` | POST | ✅ | Marcar como lida. |

---

## 17. Health

| Endpoint | Método | Status | Observação |
|----------|--------|--------|------------|
| `GET /health` | GET | ✅ | Sem auth. |

---

## Checklist rápido (backend)

- [x] Auth: login, me, forgot-password, reset-password, set-password.
- [x] Clientes: CRUD + busca inteligente (`q`) + paginação + filtros.
- [x] Veículos: CRUD + listagem por `cliente_id`.
- [x] Empresas: CRUD + listagem paginada.
- [x] Produtos: CRUD + correlatos + valor_unitario.
- [x] Orçamentos: CRUD + PATCH status + include (clientes, empresas, veiculos, usuario) + json_itens.
- [x] Relatórios: GET orcamentos com data_inicio, data_fim, status.
- [x] Usuários: CRUD + block + reset-password.
- [x] Admin: roles e permissions + atribuição de permissões.
- [x] Integrações Gmail: save, test, exchange-code.
- [x] Email templates: list, update, preview.
- [x] Oficina: list OS, get OS, get checklists (stub).
- [x] Comissões e reports: commissions, my-sales.
- [x] Pessoas: funcionarios.
- [x] Fiscal: exportacoes (stub, sem NF-e).
- [x] Notificações: list, markAsRead.
- [x] Health: GET sem auth.

---

## Regras de negócio a validar/implementar

1. **Clientes:** Validar pelo menos fantasia ou razão social; CPF/CNPJ único. Não excluir se houver orçamento/pedido (ou soft delete).
2. **Orçamentos:** Transições de status (máquina de estados); DELETE apenas em status Cotação/Cancelado.
3. **Produtos:** Código/código de barras único quando informado.
4. **Empresas:** CNPJ único quando informado.

---

**Última atualização:** 19/02/2026 (backend alinhado ao mapeamento do frontend).
