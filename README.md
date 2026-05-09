# 99Dashboard

Dashboard moderno para acompanhar oportunidades 99Freelas do Softwarehouse.

## Arquitetura atual

Sem storage, sem `.eml` físico e sem pipeline Python.

```txt
Gmail API → parser em memória → IA/heurística de precificação → Supabase → Dashboard
```

## Stack

- Next.js App Router
- React + TypeScript
- Supabase como fonte de dados
- Gmail API para importação
- IA opcional via OpenAI para precificação e chat Oracle
- Zustand persist somente para preferências de UI

## Rodar localmente

```bash
cp .env.example .env
npm install
npx supabase start
npx supabase db reset
npm run dev
```

Depois do `npx supabase start`, copie as chaves exibidas para o `.env`:

```env
DATA_BACKEND=supabase
SUPABASE_URL=http://127.0.0.1:55421
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Supabase local

Portas não-default:

- API: `55421`
- Postgres: `55422`
- Studio: `55423`
- Inbucket: `55424`
- Analytics: `55427`

## Gmail

Configure:

```env
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_LABEL_OR_QUERY=from:(99freelas.com.br) newer_than:7d
```

Importar:

```bash
curl -X POST "http://localhost:3000/api/import/gmail?token=$AUTO_IMPORT_CRON_SECRET"
```

## IA

```env
AI_PRICING_ENABLED=true
AI_PRICING_MODEL=gpt-4o-mini
CHAT_AI_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...
```

A precificação considera valor-hora, taxa da plataforma, risco, complexidade, tecnologia, funcionalidades, integrações, segurança, deploy e testes.
