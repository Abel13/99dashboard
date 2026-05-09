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
      <section className="settingsOverview glass">
        <div>
          <span className="kicker">Configuração rápida</span>
          <h2>Preferências do dashboard</h2>
        </div>
        <div className="settingsQuickActions">
          <Button variant="primary" onClick={onImportGmail} disabled={importing}>
            {importing ? <Loader2 className="loadingIcon" size={15} /> : <RefreshCw size={15} />}
            Importar Gmail
          </Button>
        </div>
      </section>

      <section className="settingsStatusGrid">
        <StatusCard label="Gmail" ok={!!gmail.configured} detail={gmail.configured ? `Última: ${fmtDate(gmail.last_import_at)}` : 'Credenciais ausentes'} />
        <StatusCard label="IA" ok={!!settings.openai_configured} detail={settings.openai_configured ? 'OpenAI configurada' : 'OPENAI_API_KEY ausente'} />
        <StatusCard
          label="Automação"
          ok={!!settings.gmail_auto_import_enabled}
          detail={settings.gmail_auto_import_enabled ? `A cada ${settings.gmail_auto_import_interval_minutes || 15} min` : 'Desligada'}
        />
      </section>

      <section className="settingsGrid">
        <Panel title="Gmail">
          <label className="fieldLabel">Query de busca<input className="input" value={settings.gmail_query || ''} onChange={(event) => patch('gmail_query', event.target.value)} /></label>
          <div className="settingsInline">
            <label className="pill"><input type="checkbox" checked={!!settings.gmail_auto_import_enabled} onChange={(event) => patch('gmail_auto_import_enabled', event.target.checked)} /> Importar automaticamente</label>
            <label className="fieldLabel compactField">Intervalo<input className="input" type="number" min="5" step="5" value={settings.gmail_auto_import_interval_minutes || 15} onChange={(event) => patch('gmail_auto_import_interval_minutes', Number(event.target.value))} /></label>
          </div>
          {gmail.last_error && <p className="errorText"><b>Erro Gmail:</b> {gmail.last_error}</p>}
          {gmail.scheduler?.last_error && <p className="errorText"><b>Erro automação:</b> {gmail.scheduler.last_error}</p>}
        </Panel>

        <Panel title="Perfil e preço">
          <div className="settingsTwoCols">
            <label className="fieldLabel">Usuário 99Freelas<input className="input" value={settings.profile_username || ''} onChange={(event) => patch('profile_username', event.target.value)} placeholder="abeldutraui" /></label>
            <label className="fieldLabel">Preço por hora<input className="input" type="number" value={settings.hourly_rate || 130} onChange={(event) => patch('hourly_rate', Number(event.target.value))} /></label>
            <label className="fieldLabel">Taxa da plataforma<input className="input" type="number" step="0.01" value={settings.platform_fee_pct || 0.2} onChange={(event) => patch('platform_fee_pct', Number(event.target.value))} /></label>
          </div>
          <p className="summary">Líquido alvo dividido por {(1 - Number(settings.platform_fee_pct || 0.2)).toFixed(2)}.</p>
        </Panel>

        <Panel title="IA">
          <StatusLine label="OpenAI" ok={!!settings.openai_configured} detail={settings.openai_configured ? 'Configurada no ambiente' : 'Configure OPENAI_API_KEY'} />
          <label className="pill"><input type="checkbox" checked={!!settings.ai_pricing_enabled} onChange={(event) => patch('ai_pricing_enabled', event.target.checked)} /> Usar IA na precificação</label>
          <div className="settingsTwoCols">
            <label className="fieldLabel">Modelo chat<input className="input" value={settings.chat_ai_model || ''} onChange={(event) => patch('chat_ai_model', event.target.value)} /></label>
            <label className="fieldLabel">Modelo pricing<input className="input" value={settings.ai_pricing_model || ''} onChange={(event) => patch('ai_pricing_model', event.target.value)} /></label>
          </div>
        </Panel>

        <Panel title="Segurança">
          <StatusLine label="Token API" ok={!!settings.dashboard_api_token_configured} detail={settings.dashboard_api_token_configured ? 'Configurado no ambiente' : 'Configure DASHBOARD_API_TOKEN'} />
        </Panel>
      </section>

      <details className="settingsDiagnostics glass">
        <summary>Diagnóstico e histórico</summary>
        <div className="diagnosticGrid">
          <div>
            <h3>Última importação</h3>
            <p><b>Status:</b> {gmail.last_ok === false ? 'falhou' : 'ok/sem erro'}</p>
            <p><b>Resultado:</b> {gmail.last_found ?? 0} encontrados · {gmail.last_parsed ?? 0} parseados · {gmail.last_unique_projects ?? '—'} projetos únicos</p>
            <p><b>Banco:</b> {gmail.last_inserted ?? '—'} inseridos · {gmail.last_updated ?? '—'} atualizados</p>
          </div>
          <div>
            <h3>Histórico recente</h3>
            <RunList runs={runs} />
          </div>
          <div>
            <h3>E-mails avaliados</h3>
            <MessageTrace messages={s.last_message_trace || []} />
          </div>
        </div>
      </details>

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

function StatusCard({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="settingsStatusCard glass">
      <span className={`dot ${ok ? 'ok' : 'bad'}`} />
      <div>
        <b>{label}</b>
        <small>{detail}</small>
      </div>
    </div>
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
