'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, Loader2, X } from 'lucide-react'
import { OracleChat } from './oracle-chat'
import { useDashboardStore } from '@/store/dashboard-store'
import { DashboardShell } from './dashboard/shell'
import { Explorer } from './dashboard/explorer'
import { MatchAnalytics } from './dashboard/match-analytics'
import { NotificationsPage, type ImportNotification } from './dashboard/notifications'
import { Overview } from './dashboard/overview'
import { Profile } from './dashboard/profile'
import { SettingsPage } from './dashboard/settings-page'
import { scoreOf, workflowStatusOf } from './dashboard/helpers'
import type { DashboardPage, Opportunity } from './dashboard/types'

const NOTIFICATION_HISTORY_KEY = '99dashboard-import-notifications'

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
  const [notifications, setNotifications] = useState<ImportNotification[]>([])
  const [activeNotification, setActiveNotification] = useState<ImportNotification | null>(null)
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

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(NOTIFICATION_HISTORY_KEY)
      if (stored) setNotifications(JSON.parse(stored).slice(0, 30))
    } catch {
      setNotifications([])
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

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
    if (response.ok && Number(body.inserted || 0) > 0) pushImportNotification(body)
    setToast(response.ok ? `Gmail: ${body.saved ?? 0} salvos / ${body.found ?? 0} encontrados` : `Erro Gmail: ${body.error || response.status}`)
    await load()
  }

  function pushImportNotification(body: any) {
    const notification: ImportNotification = {
      id: `${body.trigger || 'manual'}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      inserted: Number(body.inserted || 0),
      updated: Number(body.updated || 0),
      saved: Number(body.saved || 0),
      found: Number(body.found || 0),
      trigger: body.trigger,
    }
    setActiveNotification(notification)
    setNotifications((current) => {
      const next = [notification, ...current].slice(0, 30)
      try {
        window.localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  function clearNotificationHistory() {
    setNotifications([])
    try {
      window.localStorage.removeItem(NOTIFICATION_HISTORY_KEY)
    } catch {}
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

  function updateLocalOpportunity(updated: Opportunity) {
    setItems((current) => current.map((item) => String(item.source_project_id) === String(updated.source_project_id) ? updated : item))
  }

  async function updateReaction(item: Opportunity, reaction: string) {
    const current = new Set<string>(item.abel_feedback?.reactions || [])
    if (item.effective_status === 'liked') current.add('liked')
    if (current.has(reaction)) current.delete(reaction)
    else current.add(reaction)

    setBusy(item.source_project_id + reaction)
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: item.source_project_id,
        reactions: [...current],
        reason: `Abel atualizou reações: ${[...current].join(', ') || 'nenhuma'}`,
      }),
    })
    setBusy('')
    setToast(response.ok ? 'Reação salva' : 'Erro ao salvar reação')
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
    <DashboardShell page={page} setPage={setPage} busy={busy} onRefresh={runPipeline} status={status} notificationCount={notifications.length}>
      {loading ? (
        <div className="empty glass">
          <Loader2 className="loadingIcon" /> Carregando...
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
              onReact={updateReaction}
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
              onReact={updateReaction}
              onOpen={(id) => setSelectedId(id)}
              onProjectUpdated={updateLocalOpportunity}
            />
          )}
          {page === 'profile' && <Profile items={items} />}
          {page === 'notifications' && (
            <NotificationsPage
              notifications={notifications}
              onClear={clearNotificationHistory}
              onOpenExplorer={() => setPage('explorer')}
            />
          )}
          {page === 'settings' && <SettingsPage status={status} onImportGmail={importGmail} importing={importing} />}
        </>
      )}
      {toast && <div className="toast">{toast}</div>}
      {activeNotification && (
        <div className="importPopup glass" role="status" aria-live="polite">
          <button className="importPopupClose" onClick={() => setActiveNotification(null)} aria-label="Fechar notificação">
            <X size={16} />
          </button>
          <span className="notificationIcon"><Bell size={18} /></span>
          <div>
            <b>{activeNotification.inserted} novas oportunidades importadas</b>
            <p>{activeNotification.saved} salvas · {activeNotification.updated} atualizadas · {activeNotification.found} e-mails encontrados</p>
            <div className="importPopupActions">
              <button onClick={() => { setPage('explorer'); setActiveNotification(null) }}>Ver oportunidades</button>
              <button onClick={() => { setPage('notifications'); setActiveNotification(null) }}>Histórico</button>
            </div>
          </div>
        </div>
      )}
      <OracleChat projects={chatProjects} />
    </DashboardShell>
  )
}
