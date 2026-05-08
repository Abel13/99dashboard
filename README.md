# 99Dashboard

Dashboard moderno para acompanhar oportunidades 99Freelas do Softwarehouse.

## Stack

- Next.js App Router
- React + TypeScript
- Dark mode com `next-themes`
- Componentes estilo shadcn/ui
- Zustand persist para filtros/preferências locais
- API routes para ler dados, rodar pipeline e registrar ações

## Rodar localmente

```bash
cp .env.example .env
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Integrações

### Pipeline local existente

`POST /api/pipeline` roda o pipeline configurado em `SOFTWAREHOUSE_PIPELINE`.

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
