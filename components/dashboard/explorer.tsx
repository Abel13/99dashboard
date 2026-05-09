'use client'

import { LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { statuses } from './constants'
import { OpportunityCard, OpportunityTable } from './opportunity-list'
import type { OpenOpportunity, Opportunity, OpportunityAction, OpportunityReaction } from './types'

export function Explorer({
  filtered,
  view,
  setView,
  query,
  setQuery,
  minScore,
  setMinScore,
  activeStatuses,
  toggleStatus,
  clearStatuses,
  busy,
  onAction,
  onReact,
  onOpen,
}: {
  filtered: Opportunity[]
  view: 'list' | 'cards'
  setView: (view: 'list' | 'cards') => void
  query: string
  setQuery: (value: string) => void
  minScore: number
  setMinScore: (value: number) => void
  activeStatuses: string[]
  toggleStatus: (status: string) => void
  clearStatuses: () => void
  busy: string
  onAction: OpportunityAction
  onReact: OpportunityReaction
  onOpen: OpenOpportunity
}) {
  return (
    <>
      <section className="toolbar glass">
        <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título, descrição ou status..." />
        <select className="select" value={minScore} onChange={(event) => setMinScore(Number(event.target.value))}>
          <option value={0}>Qualquer score</option>
          <option value={40}>Score &gt;= 40</option>
          <option value={60}>Score &gt;= 60</option>
          <option value={75}>Score &gt;= 75</option>
        </select>
        <div className="viewToggle">
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
            <List size={16} />
          </button>
          <button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}>
            <LayoutGrid size={16} />
          </button>
        </div>
        <details className="filterDetails">
          <summary>Filtros de status {activeStatuses.length ? `(${activeStatuses.length})` : ''}</summary>
          <div className="statusBar">
            {statuses.map(([status, label]) => (
              <label className="pill" key={status}>
                <input type="checkbox" checked={activeStatuses.includes(status)} onChange={() => toggleStatus(status)} />
                {label}
              </label>
            ))}
            <Button onClick={clearStatuses}>Limpar</Button>
          </div>
        </details>
      </section>
      <section className="workflowLegend glass">
        <span><b>Não revisado</b> ainda não teve ação manual</span>
        <span><b>Perguntas enviadas</b> aguardando resposta do cliente</span>
        <span><b>Preparar proposta</b> pronto para montar/enviar</span>
        <span><b>Proposta enviada</b> acompanhar retorno</span>
      </section>

      {view === 'list' ? (
        <OpportunityTable items={filtered} busy={busy} onAction={onAction} onReact={onReact} onOpen={onOpen} />
      ) : (
        <section className="grid">
          {filtered.map((item) => (
            <OpportunityCard key={item.source_project_id} item={item} busy={busy} onAction={onAction} onReact={onReact} onOpen={onOpen} />
          ))}
        </section>
      )}
    </>
  )
}
