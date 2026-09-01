# Migrations

## Como aplicar

1. Abra o painel do Supabase do seu projeto.
2. Vá em **SQL Editor → New query**.
3. Cole o conteúdo de `001_init.sql` e clique em **Run**.

Alternativa via Supabase CLI:

```bash
supabase db execute --file migrations/001_init.sql
```

Depois de rodar a migration, crie o primeiro admin:

```bash
npm run create-admin --prefix backend -- admin@seudominio.com 'SuaSenhaForte123'
```
