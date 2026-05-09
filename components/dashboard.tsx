'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { OracleChat } from './oracle-chat'
import { useDashboardStore } from '@/store/dashboard-store'
import { DashboardShell } from './dashboard/shell'
import { Explorer } from './dashboard/explorer'
import { MatchAnalytics } from './dashboard/match-analytics'
import { Overview } from './dashboard/overview'
import { Profile } from './dashboard/profile'
import { SettingsPage } from './dashboard/settings-page'
import { scoreOf, workflowStatusOf } from './dashboard/helpers'
import type { DashboardPage, Opportunity } from './dashboard/types'

export function Dashboard() {
  const [items, setItems] = useState<Opportunity[]>([])
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [toast, setToast] = useState('')
  const [page, setPage] = useState<DashboardPage>('dashboard')
  const [view, setView] = useState<'list' | 'cards'>('list')
  const [selectedId, setSelectedId] = useState('')
  const [importing, setImporting] = useState(false)
  const {
    query,
    minScore,
    statuses: activeStatuses,
    setQuery,
    setMinScore,
    toggleStatus,
    clearStatuses,
  } = useDashboardStore()

  async function load() {
    setLoading(true)
    const [opportunitiesResponse, statusResponse] = await Promise.all([
      fetch('/api/opportunities', { cache: 'no-store' }),
      fetch('/api/status', { cache: 'no-store' }),
    ])
    const data = await opportunitiesResponse.json()
    const nextItems = data.items || []
    setItems(nextItems)
    setSelectedId((current) => current || (nextItems[0] ? String(nextItems[0].source_project_id) : ''))
    if (statusResponse.ok) setStatus(await statusResponse.json())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function runPipeline() {
    setBusy('pipeline')
    const response = await fetch('/api/pipeline', { method: 'POST' })
    setBusy('')
    setToast(response.ok ? 'Atualização solicitada' : 'Erro ao atualizar')
    await load()
  }

  async function importGmail() {
    setImporting(true)
    const response = await fetch('/api/import/gmail', { method: 'POST' })
    const body = await response.json().catch(() => ({}))
    setImporting(false)
    setToast(response.ok ? `Gmail: ${body.saved ?? 0} salvos / ${body.found ?? 0} encontrados` : `Erro Gmail: ${body.error || response.status}`)
    await load()
  }

  async function updateOpportunity(item: Opportunity, status: string, reason: string, outcome?: string) {
    setBusy(item.source_project_id + status)
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: item.source_project_id, status, reason, outcome }),
    })
    setBusy('')
    setToast(response.ok ? 'Status salvo' : 'Erro ao salvar status')
    await load()
  }

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const search = (query || '').toLowerCase()
        const text = `${item.title} ${item.full_description || ''} ${item.effective_status || ''}`.toLowerCase()
        const status = workflowStatusOf(item)
        return (
          (!search || text.includes(search)) &&
          scoreOf(item) >= minScore &&
          (!activeStatuses.length || activeStatuses.includes(status))
        )
      }),
    [items, query, minScore, activeStatuses]
  )

  const selected = useMemo(
    () => items.find((item) => String(item.source_project_id) === selectedId) || items[0],
    [items, selectedId]
  )
  const chatProjects = useMemo(
    () => items.map((item) => ({ id: String(item.source_project_id), title: item.title })),
    [items]
  )

  return (
    <DashboardShell page={page} setPage={setPage} busy={busy} onRefresh={runPipeline} status={status}>
      {loading ? (
        <div className="empty glass">
          <Loader2 /> Carregando...
        </div>
      ) : (
        <>
          {page === 'dashboard' && (
            <Overview
              items={items}
              onOpen={(id) => {
                setSelectedId(id)
                setPage('analytics')
              }}
            />
          )}
          {page === 'explorer' && (
            <Explorer
              filtered={filtered}
              view={view}
              setView={setView}
              query={query}
              setQuery={setQuery}
              minScore={minScore}
              setMinScore={setMinScore}
              activeStatuses={activeStatuses}
              toggleStatus={toggleStatus}
              clearStatuses={clearStatuses}
              busy={busy}
              onAction={updateOpportunity}
              onOpen={(id) => {
                setSelectedId(id)
                setPage('analytics')
              }}
            />
          )}
          {page === 'analytics' && (
            <MatchAnalytics
              items={items}
              selected={selected}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              busy={busy}
              onAction={updateOpportunity}
              onOpen={(id) => setSelectedId(id)}
            />
          )}
          {page === 'profile' && <Profile items={items} />}
          {page === 'settings' && <SettingsPage status={status} onImportGmail={importGmail} importing={importing} />}
        </>
      )}
      {toast && <div className="toast">{toast}</div>}
      <OracleChat projects={chatProjects} />
    </DashboardShell>
  )
}
