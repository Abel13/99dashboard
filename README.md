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

## Configurações operacionais

Depois de subir o app, use o menu **Configurações** para salvar no Supabase:

- usuário do perfil 99Freelas;
- preço por hora;
- taxa da plataforma;
- modelos de IA;
- chave OpenAI;
- credenciais OAuth do Gmail;
- query/label do Gmail;
- token de cron/API.

O `.env` fica apenas como bootstrap mínimo para conectar no Supabase.

Importar Gmail após configurar o token no painel:

```bash
curl -X POST "http://localhost:3000/api/import/gmail?token=SEU_TOKEN_CONFIGURADO"
```

A precificação considera valor-hora, taxa da plataforma, risco, complexidade, tecnologia, funcionalidades, integrações, segurança, deploy e testes.
