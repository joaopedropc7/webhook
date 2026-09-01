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
│   │   ├── env.baked.js         # gerado do .env (npm run bake-env), vai no bundle
│   │   ├── server.js            # bootstrap + shutdown gracioso
│   │   ├── app.js               # rotas, estáticos do React, handler de erro
│   │   ├── config.js            # .env
│   │   ├── lib/supabase.js      # client com service_role key
│   │   ├── lib/seed.js          # cria o usuário padrão no primeiro boot
│   │   ├── middleware/auth.js   # JWT em cookie httpOnly
│   │   └── routes/
│   │       ├── webhook.js       # POST /webhook/axxon  (público)
│   │       ├── auth.js          # login / logout / me
│   │       ├── logs.js          # listagem + detalhe (protegidas)
│   │       └── settings.js      # troca de senha e de usuário
│   ├── .env                     # configuração (fica aqui por causa do service root)
│   └── scripts/
│       ├── create-admin.js      # cria o admin (hash bcrypt)
│       └── hash-password.js     # só gera o hash, para colar no SQL Editor
├── frontend/                    # React + Vite (login, painel, configurações)
├── migrations/001_init.sql      # schema do Supabase
├── vercel.json                  # services (frontend + backend) e rewrites da Vercel
├── ecosystem.config.js          # pm2
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
cp .env.example backend/.env
```

> O `.env` mora em **`backend/`**, e não na raiz: é o `root` do serviço de backend na Vercel.
> Um `.env` na raiz também é lido (compatibilidade), mas não é empacotado no deploy.

Edite e preencha:

```env
PORT=3000
DEST_URL=https://apipix-delta.vercel.app/api/webhook/axxon
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=<cole aqui a saída de: openssl rand -hex 32>
COOKIE_SECURE=          # vazio = automático (true em produção, false em local)
```

### 1.5 Usuário padrão

No primeiro boot, **se a tabela `users` estiver vazia**, a aplicação cria sozinha o usuário padrão:

| Usuário | Senha |
|---------|-------|
| `admin` | `password` |

> ⚠️ Troque a senha no primeiro acesso, em **Configurações**. Enquanto ela for a padrão, o painel exibe um aviso.
> Este endpoint fica exposto na internet, e `admin`/`password` é a primeira combinação que scanners automatizados testam.

O seed só roda com a tabela vazia: ele **nunca** sobrescreve credenciais reais nem recria um usuário que você apagou.
Para mudar os valores padrão ou desligar o seed, use no `.env`:

```env
DEFAULT_ADMIN_USER=admin
DEFAULT_ADMIN_PASSWORD=password
SEED_DEFAULT_ADMIN=false     # desliga a criação automática
```

#### Criar outros usuários pela linha de comando

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
| `PATCH` | `/api/settings/password` | `{ currentPassword, newPassword }` → troca a senha (mín. 8 caracteres) |
| `PATCH` | `/api/settings/account` | `{ email, currentPassword }` → troca o usuário do login |

As duas rotas de `/api/settings` exigem a **senha atual**: só o cookie de sessão não basta para alterar credenciais.

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
- **`/configuracoes`** (protegida) — alterar a senha e o usuário do login. Ambas as ações pedem a senha atual.
- Header com o usuário logado, link para **Configurações** e botão **Sair**.
- Enquanto a senha padrão estiver em uso, um aviso aparece no topo com atalho para a troca.

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
cp .env.example backend/.env && nano backend/.env   # COOKIE_SECURE pode ficar vazio
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

Variáveis de ambiente no painel do serviço: `DEST_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `NODE_ENV=production` (o `COOKIE_SECURE` se resolve sozinho em produção).
Não defina `PORT` manualmente — a plataforma injeta a dela.

### Opção C — Vercel (Services)

O repositório traz [`vercel.json`](vercel.json) no modelo **[Vercel Services](https://vercel.com/docs/services)**,
que é o que resolve o erro `vercel.json required to deploy projects with multiple services`:
frontend e backend são declarados como dois serviços do mesmo projeto, com roteamento compartilhado.

```json
{
  "services": {
    "frontend": { "root": "frontend", "framework": "vite", ... },
    "backend":  { "root": "backend",  "framework": "express", "entrypoint": "src/server.js", ... }
  },
  "rewrites": [
    { "source": "/api/(.*)",     "destination": { "service": "backend" } },
    { "source": "/webhook/(.*)", "destination": { "service": "backend" } },
    { "source": "/health",       "destination": { "service": "backend" } },
    { "source": "/(.*)",         "destination": { "service": "frontend" } }
  ]
}
```

Três detalhes que fazem esse arquivo funcionar:

1. **`/webhook/(.*)` precisa estar nas rewrites.** Roteando só `/api`, o postback da Axxon cairia no
   serviço de frontend e voltaria 404 — o endpoint mais importante da aplicação ficaria mudo.
2. **Nada de `buildCommand`, `installCommand`, `outputDirectory`, `framework` ou `functions` no topo.**
   Com `services` presente, essas chaves só valem dentro de cada serviço; no topo, o deploy é recusado.
3. **A ordem das rewrites importa** — o catch-all `/(.*)` vai por último, senão engole tudo.

Passos:

1. **Import Project** na Vercel apontando para o repositório, com o *Root Directory* na raiz.
2. Deploy.
3. Cadastre `https://<seu-dominio>/webhook/axxon` como `postbackUrl` na Axxon.

Antes do deploy, ajuste no `backend/.env`:

```env
FORWARD_TIMEOUT_MS=6000
FORWARD_MAX_RETRIES=1
```

O reenvio é síncrono, e o pior caso é `(retries + 1) × timeout + backoff`. Com os padrões (10s / 2 retries)
isso chega a **32s**, o que estoura o `maxDuration` e faz a Axxon receber um `504` em vez do status real do
destino. Com `6000` / `1` o pior caso cai para ~12,5s.

#### Como as variáveis chegam à Vercel

O file tracing da Vercel monta o bundle da function a partir do grafo de `require()`. Um `.env` solto **não
está nesse grafo** e acaba ficando de fora — o sintoma é `{"ok":false,"missingEnv":[...]}` em `/health`.
Por isso os valores também são embutidos num módulo JavaScript, que o tracing sempre inclui:

```bash
npm run bake-env    # backend/.env  ->  backend/src/env.baked.js
```

O `backend/.env` continua sendo a **fonte de verdade**: o módulo é derivado dele, e o `buildCommand` do
serviço de backend o regenera a cada deploy. `npm run check` avisa se ele estiver desatualizado.
`PORT` e `NODE_ENV` ficam de fora de propósito — quem define esses é a plataforma.

Precedência: **painel da Vercel** > `backend/.env` > `env.baked.js`.

> `env.baked.js` contém credenciais, assim como o `.env`. Vale a mesma regra: repositório privado.

#### Detalhes da leitura do `.env`

A Vercel **não** injeta sozinha um `.env` do repositório nas variáveis de runtime — o que acontece em projetos
Vite/Next é o bundler ler o `.env` em *build time* e embutir os valores no bundle, o que é outra coisa.
Aqui a leitura em runtime funciona por dois motivos:

1. O `.env` fica em **`backend/`**, que é o `root` do serviço de backend — por isso o arquivo foi movido para lá.
   Um `.env` na raiz do repositório ficaria fora do serviço e não seria empacotado.
2. [`backend/src/config.js`](backend/src/config.js) procura o `.env` em `backend/`, na raiz do projeto e no `cwd`,
   carregando o primeiro que existir.

**Precedência:** variáveis cadastradas em *Settings → Environment Variables* **sempre vencem** o arquivo — o
`dotenv` não sobrescreve o que já está em `process.env`. O `.env` é o padrão; o painel é o override.

O log de boot diz de onde as variáveis vieram (sem imprimir valores):

```
[...] .env carregado de: /var/task/.env
```

> Se o `.env` não chegar ao bundle na sua conta, as rotas `/api` e `/webhook` respondem **503** com a lista
> das variáveis que faltam (e `GET /health` mostra o mesmo). Nesse caso, cadastre as variáveis em
> *Settings → Environment Variables* — o código funciona igual nos dois modos.

> Lembre que o `.env` versionado carrega a `service_role` key. Isso só é aceitável com o repositório **privado**.
> Se ele for exposto algum dia, resete a chave no Supabase e mova as variáveis para o painel da Vercel.

### Checklist pós-deploy

- [ ] `curl https://app.lojaconfort.site/health` → `{"ok":true}`
- [ ] HTTPS ativo e cookie saindo com `Secure` (log de boot + DevTools → Application → Cookies)
- [ ] Login com `admin` / `password` funciona **e a senha foi trocada em Configurações**
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
| `COOKIE_SECURE` | *(vazio = automático)* | vazio: `true` em produção/Vercel, `false` em local. Preencha só para forçar |
| `NODE_ENV` | `development` | |
| `SEED_DEFAULT_ADMIN` | `true` | cria o usuário padrão quando `users` está vazia |
| `DEFAULT_ADMIN_USER` | `admin` | usuário padrão |
| `DEFAULT_ADMIN_PASSWORD` | `password` | senha padrão |
| `FORWARD_TIMEOUT_MS` | `10000` | timeout de cada tentativa de reenvio |
| `FORWARD_MAX_RETRIES` | `2` | retentativas em erro de rede (0 desliga) |

O app aborta no boot com mensagem clara se faltar alguma variável obrigatória.

---

## 7. Diagnóstico

Antes de qualquer deploy, rode:

```bash
npm run check
```

Ele valida as variáveis, confirma que a chave é mesmo a `service_role`, testa a conexão, verifica as tabelas
e a função `body_text()` da migration, e lista os usuários cadastrados. Nenhum segredo é impresso.

Com a aplicação no ar, `GET /health` é o primeiro lugar a olhar:

| Resposta | Significado |
|----------|-------------|
| `{"ok":true}` | tudo certo |
| `{"ok":false,"missingEnv":[...]}` (503) | faltam variáveis de ambiente — as citadas na lista |
| `{"ok":true,"warnings":[...]}` | sobe, mas com problema de configuração (ex.: chave `anon` no lugar da `service_role`) |

Erros comuns:

- **`/api/*` responde 500 em tudo, inclusive `/api/auth/me` sem cookie** → o processo não subiu.
  Em serverless, quase sempre é variável de ambiente faltando; veja os logs da function.
- **Login sempre "Usuario ou senha invalidos", mesmo com a senha certa** → o backend está usando a chave
  `anon` em vez da `service_role`. Com RLS ligado, a consulta em `users` volta vazia em vez de dar erro.
  O boot avisa: `[config] ATENCAO: SUPABASE_SERVICE_ROLE_KEY contem a chave "anon"`.
- **Webhooks chegam mas não aparecem no painel** → mesma causa: sem a `service_role`, o insert é barrado pelo RLS.

## 8. Notas de segurança

- O usuário padrão `admin`/`password` existe para o primeiro acesso: trocar a senha é o primeiro passo em produção.
- A `service_role key` fica apenas no backend; o bundle do frontend não contém nenhuma credencial do Supabase.
- Cookie de sessão `httpOnly` + `SameSite=Lax`, com `Secure` automático em produção/Vercel.
- Login responde a mesma mensagem para email inexistente e senha errada.
- `authorization` e `cookie` dos headers recebidos são gravados como `[REDACTED]`.
- `webhook_logs` guarda o payload da Axxon como veio — trate o banco como dado sensível e restrinja quem tem acesso ao projeto Supabase.
- A busca textual (`?q=`) percorre o JSON via a função `body_text()`; em tabelas muito grandes ela faz varredura sequencial — use junto com os filtros de status.
