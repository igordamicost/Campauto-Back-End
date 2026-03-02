# Autenticação Refatorada: Access Token + Refresh Token Rotativo

## Fluxo

### Login
1. `POST /auth/login` com `{ email, password }`
2. Backend valida credenciais, cria sessão server-side
3. Retorna **access token** no body `{ token }` (compatível com frontend atual)
4. Define **refresh token** em cookie HttpOnly (nunca no body)

### Refresh
1. Frontend detecta 401 (access token expirado)
2. `POST /auth/refresh` **com credentials** (cookie enviado automaticamente)
3. Backend lê refresh token do cookie, valida sessão, aplica rotação
4. Retorna novo access token no body
5. Define novo refresh token no cookie (invalida o anterior)

### Logout
1. `POST /auth/logout` (com ou sem Bearer token)
2. Se token válido: revoga sessão no servidor
3. Limpa cookie de refresh

### GET /auth/me
- Valida access token, retorna dados do usuário (boot do app)

---

## CSRF

**Opção A**: SameSite (Lax) + checagem de Origin/Referer.

- Em produção: valida `Origin` ou `Referer` contra `CORS_ORIGINS`
- Em desenvolvimento: checagem desabilitada
- Rotas protegidas: `/auth/refresh`, `/auth/logout`

---

## Atividade (last_activity_at)

- Atualizada em requisições **mutáveis** (POST, PUT, PATCH, DELETE) autenticadas
- Não atualizada em GET/poll
- Idle timeout: se `now - last_activity_at > IDLE_TIMEOUT_MIN`, sessão é revogada no próximo refresh

---

## Variáveis de Ambiente

| Variável | Descrição | Default |
|----------|-----------|---------|
| `ACCESS_TOKEN_TTL_MIN` | Duração do access token (minutos) | 10 |
| `REFRESH_TOKEN_TTL_DAYS` | Duração máxima da sessão (dias) | 7 |
| `IDLE_TIMEOUT_MIN` | Inatividade máxima (minutos) | 30 |
| `COOKIE_SECURE` | Cookie só em HTTPS | true (false para dev) |
| `COOKIE_SAMESITE` | SameSite do cookie | lax |
| `COOKIE_DOMAIN` | Domínio do cookie. Para IDN (ex: jrcarpeças.com.br), use punycode: `xn--jrcarpeas-w3a.com.br` | (vazio) |
| `CORS_ORIGINS` | Origens permitidas (CSRF, separadas por vírgula) | (vazio) |
| `JWT_SECRET` | Segredo para JWT | (obrigatório) |

---

## Frontend

- `fetch`/`axios`: usar `credentials: 'include'` em todas as requisições autenticadas
- CORS: backend usa `credentials: true`
- Ao receber 401: chamar `POST /auth/refresh` e repetir a requisição original com o novo token
