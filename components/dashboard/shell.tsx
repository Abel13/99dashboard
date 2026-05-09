'use client'

import { Loader2, Menu, PanelLeftClose, PanelLeftOpen, RefreshCw, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { fmtDate } from './helpers'
import { nav } from './constants'
import type { DashboardPage } from './types'

export function DashboardShell({
  page,
  setPage,
  busy,
  onRefresh,
  children,
  status,
  notificationCount = 0,
}: {
  page: DashboardPage
  setPage: (page: DashboardPage) => void
  busy: string
  onRefresh: () => void
  children: ReactNode
  status: any
  notificationCount?: number
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  function navigate(nextPage: DashboardPage) {
    setPage(nextPage)
    setMobileOpen(false)
  }

  return (
    <div className={`appShell ${collapsed ? 'navCollapsed' : ''} ${mobileOpen ? 'navOpen' : ''}`}>
      <button className="mobileMenuButton" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
        <Menu size={18} />
      </button>
      {mobileOpen && <button className="navScrim" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />}
      <aside className="sidebar glass">
        <div className="navControls">
          <button className="navIconButton desktopCollapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <button className="navIconButton mobileClose" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" title="Fechar menu">
            <X size={17} />
          </button>
        </div>
        <div className="brand">
          <span>Oracle</span>
          <b>99Dashboard</b>
        </div>
        <nav>
          {nav.map(([id, Icon, label]) => (
            <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)} title={collapsed ? label : undefined} aria-label={label}>
              <Icon size={17} />
              <span>{label}</span>
              {id === 'notifications' && notificationCount > 0 && <em className="navBadge">{notificationCount}</em>}
            </button>
          ))}
        </nav>
        <div className="sideFoot">
          <ThemeToggle />
          <Button variant="primary" onClick={onRefresh} disabled={!!busy}>
            {busy === 'pipeline' ? <Loader2 className="loadingIcon" size={16} /> : <RefreshCw size={16} />}
            Atualizar
          </Button>
        </div>
      </aside>
      <main className="container pageContent">
        <Header page={page} />
        <StatusStrip status={status} />
        {children}
      </main>
    </div>
  )
}

function Header({ page }: { page: DashboardPage }) {
  const title = nav.find(([id]) => id === page)?.[2]
  return (
    <section className="topbar">
      <div>
        <span className="kicker">Oracle · Softwarehouse</span>
        <h1>{title}</h1>
      </div>
    </section>
  )
}

function StatusStrip({ status }: { status: any }) {
  const s = status?.import_state || {}
  return (
    <section className="statusStrip glass">
      <span>
        <b>Última busca Gmail</b>
        {fmtDate(s.last_import_at)} · {s.last_import_ok === false ? 'falhou' : `${s.last_saved ?? 0} salvos / ${s.last_found ?? 0} encontrados`}
      </span>
      <span>
        <b>Atualização</b>
        {fmtDate(s.updated_at)}
      </span>
      {s.last_query && (
        <span>
          <b>Filtro</b>
          {s.last_query}
        </span>
      )}
    </section>
  )
}
