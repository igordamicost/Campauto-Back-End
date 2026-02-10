# Campauto Backend

## Rodar local com Docker

```bash
docker compose up --build
```

Os CSVs devem estar em `Tabelas/` (ou `tabelas/`).

API: `http://localhost:3000`  
Swagger: `http://localhost:3000/docs`

## Rodar local com Node

1. Crie o arquivo `.env` baseado no `.env.example`
2. Instale dependências e suba:

```bash
npm install
npm run dev
```

## Subir na VPS (PM2)

1. Instale Node.js, PM2 e Git na VPS
2. Clone o projeto em `/app`
3. Configure o `.env`
4. Inicie o PM2:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Configurar DNS

1. No provedor do domínio, crie um registro `A` apontando para o IP da VPS
2. Aguarde a propagação

## Configurar GitHub Secrets

No repositório do GitHub, configure:

- `HOST` (IP ou domínio da VPS)
- `USER` (usuário SSH)
- `SSH_KEY` (chave privada)

## Deploy automático (GitHub Actions)

Ao fazer push na branch `master`, o workflow:

1. Conecta na VPS via SSH
2. Executa `git pull`
3. Instala dependências
4. Reinicia o PM2

