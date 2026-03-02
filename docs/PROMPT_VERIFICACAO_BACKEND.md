# Prompt: Verificação de Configuração do Backend

Use este prompt para validar que o backend Campauto está configurado corretamente.

---

## Instruções

Você é um engenheiro de DevOps/revisão. Analise o backend Node.js (Express) do projeto Campauto e verifique se:

1. **Variáveis de ambiente** (.env) estão corretas e consistentes com o código
2. **Banco de dados** está acessível e as migrations foram aplicadas
3. **E-mail (SMTP)** está configurado e funcional
4. **Autenticação** (JWT, refresh token, cookies) está operacional
5. **CORS e cookies** permitem o frontend acessar a API com credenciais
6. **Rotas e middlewares** estão registrados corretamente

---

## Checklist de Verificação

### 1. Variáveis de Ambiente Obrigatórias

| Variável | Usado em | Observação |
|----------|----------|------------|
| `DB_HOST` | database.js, db.js | Host do MySQL |
| `DB_PORT` | database.js | 3306 |
| `DB_USER` | database.js | Usuário MySQL |
| `DB_PASS` | database.js | Senha MySQL (não DB_PASSWORD) |
| `DB_NAME` | database.js | Nome do banco |
| `JWT_SECRET` | auth, token.service | Mínimo 32 caracteres em produção |
| `FRONT_URL` | auth.controller, emailTemplates | URL do frontend (links de e-mail) |

### 2. Variáveis de E-mail

| Variável | Usado em | Observação |
|----------|----------|------------|
| `SMTP_USER` | mail.js, email.service | E-mail de envio |
| `SMTP_PASS` | mail.js | Senha do e-mail |

*Nota: SMTP_HOST e SMTP_PORT podem estar hardcoded para Hostinger.*

### 3. Variáveis de Auth (Refresh Token)

| Variável | Usado em | Observação |
|----------|----------|------------|
| `ACCESS_TOKEN_TTL_MIN` | sessionStore | Default: 10 |
| `REFRESH_TOKEN_TTL_DAYS` | sessionStore, authCookies | Default: 7 |
| `IDLE_TIMEOUT_MIN` | sessionStore | Default: 30 |
| `COOKIE_SECURE` | authCookies | true em produção |
| `COOKIE_SAMESITE` | authCookies | lax ou strict |
| `COOKIE_DOMAIN` | authCookies | **Apenas ASCII ou punycode** (ex: xn--jrcarpeas-w3a.com.br para jrcarpeças.com.br) |
| `CORS_ORIGINS` | csrfAuth | Origens permitidas (CSRF em produção) |

### 4. COOKIE_DOMAIN com Domínios Internacionais

O backend converte automaticamente domínios com acentos (ex: jrcarpeças.com.br) para punycode. Pode usar:
- `COOKIE_DOMAIN=jrcarpeças.com.br` (convertido internamente)
- Ou punycode: `COOKIE_DOMAIN=xn--jrcarpeas-w3a.com.br`

### 5. Arquivos a Verificar

- `src/config/env.js` – variáveis obrigatórias
- `src/config/database.js` – conexão MySQL
- `src/config/mail.js` – SMTP
- `src/config/authCookies.js` – cookies
- `app.js` – CORS com `credentials: true`, cookie-parser
- `routes/auth.js` – login, refresh, logout
- `database/migrations/` – tabela auth_sessions (036)

### 6. Testes Rápidos

1. `GET /health` – deve retornar 200
2. `POST /auth/login` com `{ email, password }` – deve retornar `{ token }` e Set-Cookie
3. `GET /auth/me` com `Authorization: Bearer <token>` – deve retornar dados do usuário
4. `POST /auth/refresh` com cookie – deve retornar novo token

---

## Saída Esperada

Forneça um relatório com:
- [ ] Variáveis OK / Ajustes necessários
- [ ] Problemas encontrados e correções sugeridas
- [ ] Comandos ou alterações para corrigir
