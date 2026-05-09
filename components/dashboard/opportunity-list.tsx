'use client'

import { BarChart3, Check, Copy, ExternalLink, Heart, Send, ThumbsDown, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { brl, dt } from '@/lib/utils'
import {
  effortTag,
  moneyShort,
  nextActionFor,
  priceOf,
  riskTag,
  scoreOf,
  statusKind,
  statusLabel,
  statusOf,
} from './helpers'
import { ScoreBar, SignalDot } from './ui'
import type { OpenOpportunity, Opportunity, OpportunityAction } from './types'

export function OpportunityTable({
  items,
  busy,
  onAction,
  onOpen,
}: {
  items: Opportunity[]
  busy: string
  onAction: OpportunityAction
  onOpen: OpenOpportunity
}) {
  return (
    <section className="listView glass">
      <div className="tableHead explorerHead">
        <span>Score</span>
        <span>Projeto</span>
        <span>Status</span>
        <span>Esforço</span>
        <span>Risco</span>
        <span>IA</span>
        <span>Preço</span>
        <span>Ações</span>
      </div>
      {items.map((item) => (
        <TableRow key={item.source_project_id} item={item} busy={busy} onAction={onAction} onOpen={onOpen} />
      ))}
    </section>
  )
}

function TableRow({ item, busy, onAction, onOpen }: { item: Opportunity; busy: string; onAction: OpportunityAction; onOpen: OpenOpportunity }) {
  const ds = item.decision_support || {}
  const status = statusOf(item)
  const price = priceOf(item)
  const score = scoreOf(item)

  async function copyProposal() {
    await navigator.clipboard.writeText(ds.proposal_draft || '')
  }

  return (
    <article className="tableRow explorerRow">
      <div className="scoreCell">
        <b>{score}</b>
        <ScoreBar value={score} />
      </div>
      <div className="opportunityCell">
        <div className="eyebrow">
          #{item.source_project_id} · {item.category || '99Freelas'}
        </div>
        <h2 className="rowTitle">{item.title}</h2>
        <span className="nextAction">{nextActionFor(item)}</span>
      </div>
      <div data-label="Status">
        <span className={`chip ${statusKind(status)}`}>{item.effective_status_label || statusLabel(status)}</span>
      </div>
      <div data-label="Esforço">
        <SignalDot
          kind={effortTag(ds).includes('Alto') || effortTag(ds).includes('Enterprise') ? 'bad' : effortTag(ds).includes('Médio') ? 'warn' : 'ok'}
          label={effortTag(ds)}
        />
      </div>
      <div data-label="Risco">
        <SignalDot
          kind={riskTag(ds).includes('alto') ? 'bad' : riskTag(ds).includes('médio') ? 'warn' : 'ok'}
          label={riskTag(ds).replace('Risco ', '')}
        />
      </div>
      <div data-label="IA">
        <span className={`chip ${ds.ai_pricing?.used ? 'ok' : ''}`}>{ds.ai_pricing?.used ? 'Sim' : 'Não'}</span>
      </div>
      <div className="valueCell single" data-label="Preço">
        <b>{moneyShort(price)}</b>
      </div>
      <RowActions item={item} busy={busy} copyProposal={copyProposal} onAction={onAction} onOpen={onOpen} compact />
    </article>
  )
}

function RowActions({
  item,
  busy,
  copyProposal,
  onAction,
  onOpen,
  compact = false,
}: {
  item: Opportunity
  busy: string
  copyProposal: () => void
  onAction: OpportunityAction
  onOpen: OpenOpportunity
  compact?: boolean
}) {
  return (
    <div className="rowActions">
      <Button variant="primary" disabled={busy.includes(item.source_project_id)} onClick={() => onAction(item, 'proposal_sent', 'Abel enviou proposta ao cliente')}>
        <Send size={15} />
        {compact ? 'Enviada' : 'Proposta enviada'}
      </Button>
      <Button onClick={copyProposal} title="Copiar proposta">
        <Copy size={15} />
        {!compact && 'Copiar'}
      </Button>
      <Button onClick={() => onOpen(String(item.source_project_id))} title="Analisar no Match Analytics">
        <BarChart3 size={15} />
        {!compact && 'Analisar'}
      </Button>
      {item.project_url && (
        <a className={`btn secondary ${compact ? 'iconBtn' : ''}`} target="_blank" href={item.project_url}>
          <ExternalLink size={15} />
          {!compact && 'Abrir'}
        </a>
      )}
      <details className="moreActions">
        <summary>Mais</summary>
        <div>
          <Button onClick={() => onAction(item, 'review', 'Abel enviou perguntas ao cliente; aguardando respostas')}>
            <Check size={15} />
            Perguntas
          </Button>
          <Button onClick={() => onAction(item, 'liked', 'Abel gostou da oportunidade')}>
            <Heart size={15} />
            Gostei
          </Button>
          <Button variant="danger" onClick={() => onAction(item, 'discarded', 'Abel descartou a oportunidade')}>
            <ThumbsDown size={15} />
            Descartar
          </Button>
          <Button variant="danger" onClick={() => onAction(item, 'lost', 'Projeto perdido/cancelado', 'lost')}>
            <XCircle size={15} />
            Perdido
          </Button>
        </div>
      </details>
    </div>
  )
}

export function OpportunityCard({ item, busy, onAction, onOpen }: { item: Opportunity; busy: string; onAction: OpportunityAction; onOpen: OpenOpportunity }) {
  const ds = item.decision_support || {}
  const pd = item.page_details || {}
  const status = item.effective_status || ds.status_manual || 'review'
  const price = ds.price_suggested_effective ?? ds.price_suggested
  const calc = ds.pricing_calc || {}

  async function copyProposal() {
    await navigator.clipboard.writeText(ds.proposal_draft || '')
  }

  return (
    <article className="card glass">
      <div className="cardHeader">
        <div>
          <div className="eyebrow">
            #{item.source_project_id} · {pd.subcategory || item.category || '99Freelas'}
          </div>
          <h2 className="title">{item.title}</h2>
        </div>
        <div className="score">{item.analysis?.final_score || 0}</div>
      </div>
      <p className="summary">
        {(item.full_description || item.description_preview || '').slice(0, 240)}
        {(item.full_description || '').length > 240 ? '…' : ''}
      </p>
      <div className="chips">
        <span className={`chip ${statusKind(status)}`}>{item.effective_status_label || status}</span>
        {ds.ai_pricing?.used && <span className="chip ok">Precificado por IA</span>}
        <span className="chip">{pd.proposals ?? '—'} propostas</span>
        <span className="chip">{pd.interested ?? '—'} interessados</span>
        {pd.is_exclusive && <span className="chip warn">Exclusivo até {dt(pd.exclusive_until_estimated)}</span>}
      </div>
      <div className="decision">
        <div className="box">
          <span>Preço sugerido</span>
          <b>{brl(price)}</b>
        </div>
        <div className="box">
          <span>Líquido alvo</span>
          <b>{brl(calc.net_target_suggested)}</b>
        </div>
        <div className="box">
          <span>Esforço</span>
          <b>{ds.effort_estimate || '—'}</b>
        </div>
        <div className="box">
          <span>Prazo</span>
          <b>{ds.delivery_estimate || '—'}</b>
        </div>
      </div>
      <details className="details">
        <summary>Análise, perguntas e proposta</summary>
        <p className="summary">
          <b>Precificação:</b> {ds.pricing_note}
        </p>
        <div className="box">
          <span>Perguntas ao cliente</span>
          <ol>{(ds.questions_to_client || []).map((q: string) => <li key={q}>{q}</li>)}</ol>
        </div>
        <pre className="proposal">{ds.proposal_draft}</pre>
      </details>
      <div className="actions">
        <RowActions item={item} busy={busy} copyProposal={copyProposal} onAction={onAction} onOpen={onOpen} />
      </div>
    </article>
  )
}
