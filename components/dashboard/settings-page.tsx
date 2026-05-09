'use client'

import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmtDate } from './helpers'
import { Panel, StatusLine } from './ui'

export function SettingsPage({
  status,
  onImportGmail,
  importing,
}: {
  status: any
  onImportGmail: () => void
  importing: boolean
}) {
  const s = status?.import_state || {}
  const gmail = status?.gmail || {}
  const runs = status?.import_runs || []
  const [settings, setSettings] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setSettings(data.settings || {}))
  }, [])

  function patch(key: string, value: any) {
    setSettings((current: any) => ({ ...current, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setMsg('')
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    setMsg(response.ok ? 'Configurações salvas no Supabase' : 'Erro ao salvar configurações')
  }

  if (!settings) return <div className="empty glass"><Loader2 className="loadingIcon" /> Carregando configurações...</div>

  return (
    <>
      <section className="dashboardGrid">
        <Panel title="Importação Gmail">
          <div className="gmailImportHero">
            <div>
              <StatusLine label="Gmail OAuth" ok={!!gmail.configured} detail={gmail.configured ? 'Credenciais presentes no .env' : 'Configure GMAIL_CLIENT_ID, SECRET e REFRESH_TOKEN no .env'} />
              <p><b>Query usada:</b> {gmail.query || settings.gmail_query}</p>
              <p><b>Última importação:</b> {fmtDate(gmail.last_import_at)} · {gmail.last_ok === false ? 'falhou' : 'ok/sem erro'}</p>
              <p><b>Resultado:</b> {gmail.last_found ?? 0} encontrados · {gmail.last_parsed ?? 0} parseados · {gmail.last_unique_projects ?? '—'} projetos únicos</p>
              <p><b>Banco:</b> {gmail.last_inserted ?? '—'} inseridos · {gmail.last_updated ?? '—'} atualizados · {gmail.last_duplicate_in_run ?? 0} duplicados no run</p>
              {gmail.last_error && <p className="errorText"><b>Erro:</b> {gmail.last_error}</p>}
              <p className="summary">A lista abaixo mostra exatamente quais e-mails o Gmail devolveu para essa query e por que cada um foi salvo ou ignorado.</p>
            </div>
            <Button variant="primary" onClick={onImportGmail} disabled={importing}>
              {importing ? <Loader2 className="loadingIcon" size={15} /> : <RefreshCw size={15} />}
              Importar Gmail agora
            </Button>
          </div>
        </Panel>

        <Panel title="Como a importação funciona">
          <ol className="softList">
            <li>Usa credenciais OAuth do Gmail que ficam somente no `.env`.</li>
            <li>Busca mensagens pela query configurada.</li>
            <li>Baixa cada mensagem em formato raw direto da Gmail API.</li>
            <li>Parseia o MIME em memória, sem salvar `.eml`.</li>
            <li>Extrai dados do projeto 99Freelas.</li>
            <li>Enriquece com heurística/IA conforme configuração.</li>
            <li>Faz upsert da oportunidade no Supabase.</li>
          </ol>
        </Panel>

        <Panel title="Histórico recente de importações">
          <RunList runs={runs} />
        </Panel>

        <Panel title="Últimos e-mails avaliados">
          <MessageTrace messages={s.last_message_trace || []} />
        </Panel>

        <Panel title="Profile">
          <label className="fieldLabel">Usuário 99Freelas<input className="input" value={settings.profile_username || ''} onChange={(event) => patch('profile_username', event.target.value)} placeholder="abeldutraui" /></label>
          <label className="fieldLabel">Eficiência do perfil (%)<input className="input" type="number" value={settings.profile_efficiency_pct || 0} onChange={(event) => patch('profile_efficiency_pct', Number(event.target.value))} /></label>
        </Panel>

        <Panel title="OpenAI / IA">
          <StatusLine label="OpenAI key" ok={!!settings.openai_configured} detail={settings.openai_configured ? 'Configurada no .env' : 'Configure OPENAI_API_KEY no .env'} />
          <label className="pill"><input type="checkbox" checked={!!settings.ai_pricing_enabled} onChange={(event) => patch('ai_pricing_enabled', event.target.checked)} /> Usar IA na precificação</label>
          <label className="fieldLabel">Modelo chat<input className="input" value={settings.chat_ai_model || ''} onChange={(event) => patch('chat_ai_model', event.target.value)} /></label>
          <label className="fieldLabel">Modelo pricing<input className="input" value={settings.ai_pricing_model || ''} onChange={(event) => patch('ai_pricing_model', event.target.value)} /></label>
        </Panel>

        <Panel title="Precificação">
          <label className="fieldLabel">Preço por hora<input className="input" type="number" value={settings.hourly_rate || 130} onChange={(event) => patch('hourly_rate', Number(event.target.value))} /></label>
          <label className="fieldLabel">Taxa da plataforma<input className="input" type="number" step="0.01" value={settings.platform_fee_pct || 0.2} onChange={(event) => patch('platform_fee_pct', Number(event.target.value))} /></label>
          <p className="summary">Regra atual: líquido alvo ÷ {(1 - Number(settings.platform_fee_pct || 0.2)).toFixed(2)}.</p>
        </Panel>

        <Panel title="Gmail query">
          <label className="fieldLabel">Query/label<input className="input" value={settings.gmail_query || ''} onChange={(event) => patch('gmail_query', event.target.value)} /></label>
          <p className="summary">A query fica no Supabase; as credenciais ficam no `.env`.</p>
        </Panel>

        <Panel title="Segurança / automação">
          <StatusLine label="Token API/cron" ok={!!settings.dashboard_api_token_configured} detail={settings.dashboard_api_token_configured ? 'Configurado no .env' : 'Configure DASHBOARD_API_TOKEN no .env'} />
          <p className="summary">Esse token protege chamadas externas como importação Gmail.</p>
        </Panel>
      </section>

      <section className="saveBar glass">
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="loadingIcon" size={15} /> : <SlidersHorizontal size={15} />}
          Salvar configurações
        </Button>
        {msg && <span>{msg}</span>}
      </section>
    </>
  )
}

function RunList({ runs }: { runs: any[] }) {
  return (
    <div className="runList">
      {runs.length ? runs.map((run) => (
        <div className="runItem" key={run.id}>
          <span className={`dot ${run.ok ? 'ok' : 'bad'}`} />
          <div>
            <b>{fmtDate(run.created_at)} · {run.kind}</b>
            <small>{run.saved ?? 0} upserts / {run.found ?? 0} encontrados · {run.query}</small>
            {run.error && <small className="errorText">{run.error}</small>}
          </div>
        </div>
      )) : <p className="summary">Nenhum run registrado ainda.</p>}
    </div>
  )
}

function MessageTrace({ messages }: { messages: any[] }) {
  return (
    <div className="runList">
      {messages.length ? messages.map((message) => (
        <div className="runItem" key={message.id}>
          <span className={`dot ${message.project_id ? 'ok' : message.error ? 'bad' : ''}`} />
          <div>
            <b>{message.project_id ? `#${message.project_id} · ${message.title}` : (message.subject || message.id)}</b>
            <small>{message.date ? fmtDate(message.date) : ''} · {message.from}</small>
            <small>{message.project_id ? 'Salvo/atualizado no Supabase' : (message.skipped_reason || message.error || 'Ignorado')}</small>
          </div>
        </div>
      )) : <p className="summary">Nenhum detalhe de e-mail registrado ainda. Rode uma importação para preencher.</p>}
    </div>
  )
}
