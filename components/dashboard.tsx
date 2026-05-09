'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Loader2, X } from 'lucide-react'
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
const queryKeys = {
  opportunities: ['opportunities'] as const,
  status: ['status'] as const,
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `${response.status} ${response.statusText}`)
  return body as T
}

export function Dashboard() {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState('')
  const [toast, setToast] = useState('')
  const [page, setPage] = useState<DashboardPage>('dashboard')
  const [view, setView] = useState<'list' | 'cards'>('list')
  const [selectedId, setSelectedId] = useState('')
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

  const opportunitiesQuery = useQuery({
    queryKey: queryKeys.opportunities,
    queryFn: () => fetchJson<{ items: Opportunity[] }>('/api/opportunities'),
  })
  const statusQuery = useQuery({
    queryKey: queryKeys.status,
    queryFn: () => fetchJson<any>('/api/status'),
  })

  const items = opportunitiesQuery.data?.items || []
  const status = statusQuery.data || null
  const loading = opportunitiesQuery.isLoading || statusQuery.isLoading

  useEffect(() => {
    if (!selectedId && items[0]) setSelectedId(String(items[0].source_project_id))
  }, [items, selectedId])

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

  function invalidateDashboard() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities }),
      queryClient.invalidateQueries({ queryKey: queryKeys.status }),
    ])
  }

  const gmailMutation = useMutation({
    mutationFn: () => fetchJson<any>('/api/import/gmail', { method: 'POST' }),
    onSuccess: async (body) => {
      if (Number(body.inserted || 0) > 0) pushImportNotification(body)
      setToast(`Gmail: ${body.saved ?? 0} salvos / ${body.found ?? 0} encontrados`)
      await invalidateDashboard()
    },
    onError: (error: Error) => setToast(`Erro Gmail: ${error.message}`),
  })

  const feedbackMutation = useMutation({
    mutationFn: ({ item, body }: { item: Opportunity; body: any }) => {
      setBusy(String(item.source_project_id) + (body.status || body.reactions?.join(',') || 'feedback'))
      return fetchJson('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId: item.source_project_id, ...body }),
      })
    },
    onSuccess: async (_body, variables) => {
      setToast(variables.body.status ? 'Status salvo' : 'Reação salva')
      await invalidateDashboard()
    },
    onError: (error: Error) => setToast(`Erro ao salvar: ${error.message}`),
    onSettled: () => setBusy(''),
  })

  async function importGmail() {
    gmailMutation.mutate()
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
    feedbackMutation.mutate({ item, body: { status, reason, outcome } })
  }

  function updateLocalOpportunity(updated: Opportunity) {
    queryClient.setQueryData<{ items: Opportunity[] }>(queryKeys.opportunities, (current) => ({
      items: (current?.items || []).map((item) => String(item.source_project_id) === String(updated.source_project_id) ? updated : item),
    }))
    void queryClient.invalidateQueries({ queryKey: queryKeys.status })
  }

  async function updateReaction(item: Opportunity, reaction: string) {
    const current = new Set<string>(item.abel_feedback?.reactions || [])
    if (item.effective_status === 'liked') current.add('liked')
    if (current.has(reaction)) current.delete(reaction)
    else current.add(reaction)

    feedbackMutation.mutate({
      item,
      body: {
        reactions: [...current],
        reason: `Abel atualizou reações: ${[...current].join(', ') || 'nenhuma'}`,
      },
    })
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

  return (
    <DashboardShell page={page} setPage={setPage} status={status} notificationCount={notifications.length}>
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
          {page === 'settings' && <SettingsPage status={status} onImportGmail={importGmail} importing={gmailMutation.isPending} />}
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
    </DashboardShell>
  )
}
