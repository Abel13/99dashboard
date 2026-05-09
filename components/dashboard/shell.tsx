'use client'

import { Loader2, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
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
}: {
  page: DashboardPage
  setPage: (page: DashboardPage) => void
  busy: string
  onRefresh: () => void
  children: ReactNode
  status: any
}) {
  return (
    <div className="appShell">
      <aside className="sidebar glass">
        <div className="brand">
          <span>Oracle</span>
          <b>99Dashboard</b>
        </div>
        <nav>
          {nav.map(([id, Icon, label]) => (
            <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sideFoot">
          <ThemeToggle />
          <Button variant="primary" onClick={onRefresh} disabled={!!busy}>
            {busy === 'pipeline' ? <Loader2 size={16} /> : <RefreshCw size={16} />}
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
