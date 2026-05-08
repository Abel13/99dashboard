# 99Dashboard

Dashboard moderno para acompanhar oportunidades 99Freelas do Softwarehouse, com Supabase como fonte de dados.

## Stack

- Next.js App Router
- React + TypeScript
- Dark mode com `next-themes`
- Componentes estilo shadcn/ui
- Zustand persist para filtros/preferências locais
- API routes para ler dados, rodar pipeline, importar Gmail e registrar ações
- Pipeline Python embutido em `scripts/`
- Supabase local/remoto como banco principal
- `.runtime/` apenas para arquivos temporários do pipeline, ignorado pelo git

## Rodar localmente

```bash
cp .env.example .env
npm install
npx supabase start
npx supabase db reset
npm run dev
```

Abra `http://localhost:3000`.

Depois do `npx supabase start`, copie as chaves exibidas para o `.env`:

```env
DATA_BACKEND=supabase
SUPABASE_URL=http://127.0.0.1:55421
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Pastas importantes

- `scripts/update_pipeline.sh`: executa parse → enrich → decisão → feedback.
- `supabase/`: configuração e migrations do banco local.
- `.runtime/`: temporário, ignorado pelo git; não é fonte de dados.

## Banco de dados

O app usa Supabase para oportunidades, feedback e estado de importação.

### Supabase local

As portas foram alteradas para não conflitar com outros projetos:

- API: `55421`
- Postgres: `55422`
- Studio: `55423`
- Inbucket: `55424`
- Analytics: `55427`

Para subir:

```bash
npx supabase start
```

Para aplicar/resetar schema local:

```bash
npx supabase db reset
```

## Integrações

### Precificação com IA opcional

Por padrão, a precificação usa a régua local determinística. Para adicionar uma camada de IA que leia cada projeto e revise horas, riscos, perguntas e justificativa:

```env
AI_PRICING_ENABLED=true
AI_PRICING_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...
```

A IA respeita as regras fixas:

- valor-hora configurado em `PRICING_HOURLY_RATE`;
- taxa da plataforma configurada em `PRICING_PLATFORM_FEE_PCT`;
- preço ao cliente = líquido alvo ÷ `(1 - taxa)`.

Se a IA falhar ou a chave não estiver configurada, o pipeline mantém a heurística como fallback.

### Chat Oracle IA

O dashboard inclui um chat para conversar com a Oracle sobre os projetos. Ele usa `OPENAI_API_KEY` e recebe como contexto os projetos atuais do dashboard.

```env
CHAT_AI_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...
```

Você pode conversar sobre preço, prazo, riscos, perguntas para o cliente, proposta e decisão comercial. O chat não envia propostas automaticamente.

### Pipeline

`POST /api/pipeline` roda `./scripts/update_pipeline.sh`, usa `.runtime/` como área temporária e sincroniza o resultado com Supabase.

### Feedback / botões de ação

`POST /api/feedback` atualiza o feedback no Supabase. O dashboard já usa estes botões:

- Proposta enviada
- Perguntas enviadas
- Gostei
- Descartar
- Perdido
- Copiar proposta

### Importação automática Gmail → Pipeline → Supabase

`GET|POST /api/import/gmail?token=...`

Usa as envs:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_LABEL_OR_QUERY`

A rota baixa mensagens como `.eml` temporário em `.runtime/emls`, roda o pipeline e grava oportunidades/estado no Supabase.

## Deploy

Preencha `.env` no servidor usando `.env.example`. Para cron externo, chame:

```bash
curl -X POST "https://SEU_DOMINIO/api/import/gmail?token=$AUTO_IMPORT_CRON_SECRET"
```

ou use `Authorization: Bearer $AUTO_IMPORT_CRON_SECRET`.
