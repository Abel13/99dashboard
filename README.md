# 99Dashboard

Dashboard moderno e self-contained para acompanhar oportunidades 99Freelas do Softwarehouse.

## Stack

- Next.js App Router
- React + TypeScript
- Dark mode com `next-themes`
- Componentes estilo shadcn/ui
- Zustand persist para filtros/preferências locais
- API routes para ler dados, rodar pipeline, importar Gmail e registrar ações
- Pipeline Python embutido em `scripts/`
- Storage local em `storage/`

## Rodar localmente

```bash
cp .env.example .env
npm install
npm run dev
```

Abra `http://localhost:3000`.

Por padrão, o app já funciona com caminhos relativos:

```env
SOFTWAREHOUSE_WORKSPACE=./storage
SOFTWAREHOUSE_PIPELINE=./scripts/update_pipeline.sh
SOFTWAREHOUSE_FEEDBACK=./storage/data/feedback.json
SOFTWAREHOUSE_OPPORTUNITIES=./storage/out/opportunities.feedback.json
SOFTWAREHOUSE_EML_DIR=./storage/emls
```

Ou seja: você pode clonar em outro computador e rodar sem depender dos caminhos do ambiente Oracle/WSL.

## Pastas importantes

- `storage/emls/`: coloque aqui arquivos `.eml` do 99Freelas ou deixe a importação Gmail salvar automaticamente.
- `storage/data/feedback.json`: feedback/status salvo pelos botões.
- `storage/out/opportunities.feedback.json`: JSON final lido pelo dashboard.
- `storage/pages/`: cache das páginas enriquecidas.
- `scripts/update_pipeline.sh`: executa parse → enrich → decisão → feedback.

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

### Pipeline self-contained

`POST /api/pipeline` roda `./scripts/update_pipeline.sh` e atualiza `storage/out/opportunities.feedback.json`.

### Feedback / botões de ação

`POST /api/feedback` atualiza `feedback.json` e regenera o pipeline. O dashboard já usa esses botões:

- Proposta enviada
- Perguntas enviadas
- Gostei
- Descartar
- Perdido
- Copiar proposta

### Importação automática Gmail → EML → Pipeline

`GET|POST /api/import/gmail?token=...`

Usa as envs:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_LABEL_OR_QUERY`
- `SOFTWAREHOUSE_EML_DIR`

A rota baixa mensagens como `.eml` na pasta configurada e roda o pipeline quando houver arquivos novos.

## Deploy

Preencha `.env` no servidor usando `.env.example`. Para cron externo, chame:

```bash
curl -X POST "https://SEU_DOMINIO/api/import/gmail?token=$AUTO_IMPORT_CRON_SECRET"
```

ou use `Authorization: Bearer $AUTO_IMPORT_CRON_SECRET`.

## Observação de persistência

Em produção, garanta que a pasta `storage/` esteja em volume persistente. Em plataformas serverless com filesystem efêmero, prefira montar volume, usar VPS, ou adaptar para banco/objeto externo.
