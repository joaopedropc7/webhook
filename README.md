# Axxon Pay — Webhook Proxy

Proxy/forwarder de webhooks da **Axxon Pay** com painel administrativo protegido por login e logs no **Supabase**.

```
Axxon Pay  ──POST──►  esta app  ──► 1. salva no Supabase
                          │         2. reencaminha o MESMO payload para DEST_URL
                          │         3. salva status + resposta do reenvio
                          └──────►  devolve à Axxon o MESMO status HTTP do destino
```

> **A URL pública desta aplicação é o valor que deve ser cadastrado como `postbackUrl` na Axxon Pay:**
>
> ```
> https://app.lojaconfort.site/webhook/axxon
> ```
>
> (troque pelo seu domínio; o caminho `/webhook/axxon` é fixo)

---

## Stack

| Camada   | Tecnologia |
|----------|------------|
| Frontend | React 18 + Vite + React Router 6 + Bootstrap 5 |
| Backend  | Node.js + Express 4 (CommonJS) |
| Banco    | Supabase (Postgres), acessado com a **service_role key** |
| Auth     | bcrypt + JWT em cookie `httpOnly` |
| Reenvio  | axios (timeout 10s, até 2 retentativas em erro de rede) |

A `service_role key` existe **somente no backend**. O frontend nunca fala com o Supabase — só com o Express, via cookie de sessão.

---

## Estrutura

```
.
├── backend/
│   ├── src/
│   │   ├── server.js            # bootstrap + shutdown gracioso
│   │   ├── app.js               # rotas, estáticos do React, handler de erro
│   │   ├── config.js            # .env
│   │   ├── lib/supabase.js      # client com service_role key
│   │   ├── middleware/auth.js   # JWT em cookie httpOnly
│   │   └── routes/
│   │       ├── webhook.js       # POST /webhook/axxon  (público)
│   │       ├── auth.js          # login / logout / me
│   │       └── logs.js          # listagem + detalhe (protegidas)
│   └── scripts/
│       ├── create-admin.js      # cria o admin (hash bcrypt)
│       └── hash-password.js     # só gera o hash, para colar no SQL Editor
├── frontend/                    # React + Vite (build vai para frontend/dist)
├── migrations/001_init.sql      # schema do Supabase
├── .env.example
└── package.json                 # scripts do monorepo
```

---

## 1. Rodar localmente

### 1.1 Pré-requisitos
Node.js 18+ e uma conta no Supabase.

### 1.2 Instalar dependências

```bash
npm run install:all
```

### 1.3 Configurar o Supabase

1. Crie um projeto em <https://supabase.com>.
2. Abra **SQL Editor → New query**, cole o conteúdo de [`migrations/001_init.sql`](migrations/001_init.sql) e clique em **Run**.
   Isso cria `users`, `webhook_logs`, o índice, desabilita RLS e cria a função `body_text()` usada pela busca do painel.
3. Vá em **Project Settings → API** e copie:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** (em *Project API keys*, seção `secret`) → `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ A `service_role` key ignora RLS e dá acesso total ao banco. Nunca coloque em código do frontend, em repositório público ou em variável com prefixo `VITE_`.

### 1.4 Criar o `.env`

```bash
cp .env.example .env
```

Edite e preencha:

```env
PORT=3000
DEST_URL=https://apipix-delta.vercel.app/api/webhook/axxon
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=<cole aqui a saída de: openssl rand -hex 32>
COOKIE_SECURE=false     # true em produção (HTTPS)
```

### 1.5 Criar o primeiro admin

A senha **nunca** é gravada em texto puro — só o hash bcrypt (custo 12) vai para o banco.

```bash
# opção A: o script grava direto no Supabase
npm run create-admin -- admin@lojaconfort.site 'SuaSenhaForte123'

# ou sem passar a senha na linha de comando (o script pergunta):
npm run create-admin -- admin@lojaconfort.site
```

Rodar de novo com o mesmo email **atualiza a senha** desse usuário.

```bash
# opção B: só gerar o hash e inserir você mesmo no SQL Editor do Supabase
npm run hash -- 'SuaSenhaForte123'
# saída:  insert into users (email, password_hash) values ('admin@seudominio.com', '$2b$12$...');
```

> Dica: se usar a opção A com a senha na linha de comando, limpe o histórico do shell depois
> (`history -d <n>` no bash, ou prefixe o comando com um espaço no zsh com `HIST_IGNORE_SPACE`).

### 1.6 Subir em modo dev

```bash
npm run dev
```

- Backend: <http://localhost:3000>
- Painel: <http://localhost:5173> (o Vite faz proxy de `/api` e `/webhook` para a 3000, então o cookie de sessão funciona normalmente)

### 1.7 Testar o webhook

```bash
curl -i -X POST http://localhost:3000/webhook/axxon \
  -H 'Content-Type: application/json' \
  -d '{"transactionId":"tx_teste_1","status":"PAID","amount":1050}'
```

A resposta traz o **mesmo status HTTP** que o `DEST_URL` devolveu. Recarregue o painel: o webhook aparece na lista.

---

## 2. Rotas

### Públicas (sem auth)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET`  | `/` | Healthcheck → `200 {"ok":true}` (em produção, com o build presente, a raiz serve o painel; use `Accept: application/json` ou `/health` para o healthcheck) |
| `GET`  | `/health` | Healthcheck → `200 {"ok":true}` |
| `POST` | `/webhook/axxon` | **Endpoint da Axxon** (o `postbackUrl`) |

Comportamento do `POST /webhook/axxon`:

1. Salva em `webhook_logs`: `gateway='axxon'`, `source_ip` (respeita `X-Forwarded-For`), `received_headers` (com `authorization`/`cookie` redigidos), `received_body` (o JSON cru).
2. Reencaminha o `received_body` **idêntico** — sem adicionar, remover ou renomear campos — via `POST` para `DEST_URL`, com `Content-Type: application/json` e timeout de 10s.
   Retenta **até 2×** apenas em erro de rede/timeout, com backoff de 500ms e 1500ms. Erro HTTP (4xx/5xx) **não** gera retentativa — é resposta válida do destino.
3. Atualiza a linha com `forwarded_url`, `forwarded_status`, `forwarded_response`, `forwarded_at`, `success`, `error`.
4. **Responde à Axxon com o mesmo status HTTP do destino** (estratégia síncrona: se falhar, a Axxon reenvia sozinha). Se nem foi possível falar com o destino, responde `502`.

Tudo dentro de `try/catch`: falha no Supabase ou no destino nunca derruba o processo, e um body que não seja JSON válido é gravado como `{"_raw": "..."}` e reencaminhado byte a byte.

### Protegidas (cookie JWT)

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/auth/login` | `{ email, password }` → valida bcrypt e seta o cookie |
| `POST` | `/api/auth/logout` | limpa o cookie |
| `GET`  | `/api/auth/me` | usuário logado |
| `GET`  | `/api/logs` | `?page=1&limit=20&success=true|false&q=texto` → `{ data, page, limit, total, totalPages }`, ordenado por `created_at desc` |
| `GET`  | `/api/logs/:id` | log completo (recebido + reenviado) |

Sem cookie válido, as rotas `/api/logs*` e `/api/auth/me` respondem `401`, e o painel redireciona para `/login`.

---

## 3. Painel

- **`/login`** — email + senha, com mensagem de erro em credenciais inválidas.
- **`/`** (protegida) — tabela com data/hora, gateway, badge verde/vermelho do reenvio, status HTTP e **Ver detalhes**.
  Filtros por sucesso/erro, busca textual no conteúdo recebido e itens por página.
  A paginação mantém a página ao navegar e volta para a página 1 sempre que um filtro muda.
- **Detalhe** (modal) — lado a lado, em blocos `<pre>` com JSON formatado:
  - *Recebido da Axxon*: `received_body`, `received_headers`
  - *Reenviado ao sistema*: `forwarded_url`, `forwarded_status`, `forwarded_response`, `error`
- Header com o email do usuário logado e botão **Sair**.

---

## 4. Build

```bash
npm run build     # gera frontend/dist
npm start         # Express na PORT, servindo a API + o build do React
```

Com `frontend/dist` presente, o Express serve os estáticos e faz o fallback de SPA — o painel e a API rodam na **mesma origem e na mesma porta**, então o cookie `httpOnly` funciona sem CORS.

---

## 5. Deploy

### Opção A — VPS com pm2 + nginx (recomendado para domínio próprio)

```bash
# na VPS
git clone <seu-repo> /var/www/axxon-proxy
cd /var/www/axxon-proxy

npm run install:all
cp .env.example .env && nano .env        # preencha e use COOKIE_SECURE=true
npm run build

npm run create-admin -- admin@lojaconfort.site 'SuaSenhaForte123'

npm i -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup                              # habilita o boot automático
```

nginx (`/etc/nginx/sites-available/app.lojaconfort.site`):

```nginx
server {
    listen 80;
    server_name app.lojaconfort.site;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/app.lojaconfort.site /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d app.lojaconfort.site      # HTTPS (a Axxon exige)
```

Atualizações:

```bash
git pull && npm run install:all && npm run build && pm2 restart axxon-webhook-proxy
```

### Opção B — Render / Railway

| Campo | Valor |
|-------|-------|
| Build command | `npm run install:all && npm run build` |
| Start command | `npm start` |
| Health check path | `/health` |

Variáveis de ambiente no painel do serviço: `DEST_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `COOKIE_SECURE=true`, `NODE_ENV=production`.
Não defina `PORT` manualmente — a plataforma injeta a dela.

> Evite plataformas serverless (Vercel Functions, Lambda) para este serviço: o reenvio é síncrono e pode levar até ~12s com as retentativas, o que estoura o limite de execução de vários planos.

### Checklist pós-deploy

- [ ] `curl https://app.lojaconfort.site/health` → `{"ok":true}`
- [ ] `COOKIE_SECURE=true` e HTTPS ativo
- [ ] Login funciona e o painel abre
- [ ] `POST` de teste em `/webhook/axxon` aparece no painel com badge verde
- [ ] **`https://app.lojaconfort.site/webhook/axxon` cadastrado como `postbackUrl` na Axxon Pay**

---

## 6. Configuração (`.env`)

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3000` | porta do Express |
| `DEST_URL` | `https://apipix-delta.vercel.app/api/webhook/axxon` | destino do reenvio |
| `SUPABASE_URL` | — | **obrigatório** |
| `SUPABASE_SERVICE_ROLE_KEY` | — | **obrigatório**, só no backend |
| `JWT_SECRET` | — | **obrigatório**, `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | `12h` | validade da sessão |
| `COOKIE_NAME` | `axxon_session` | nome do cookie |
| `COOKIE_SECURE` | `false` | `true` em produção (HTTPS) |
| `NODE_ENV` | `development` | |

O app aborta no boot com mensagem clara se faltar alguma variável obrigatória.

---

## 7. Notas de segurança

- A `service_role key` fica apenas no backend; o bundle do frontend não contém nenhuma credencial do Supabase.
- Cookie de sessão `httpOnly` + `SameSite=Lax` (e `Secure` quando `COOKIE_SECURE=true`).
- Login responde a mesma mensagem para email inexistente e senha errada.
- `authorization` e `cookie` dos headers recebidos são gravados como `[REDACTED]`.
- `webhook_logs` guarda o payload da Axxon como veio — trate o banco como dado sensível e restrinja quem tem acesso ao projeto Supabase.
- A busca textual (`?q=`) percorre o JSON via a função `body_text()`; em tabelas muito grandes ela faz varredura sequencial — use junto com os filtros de status.
