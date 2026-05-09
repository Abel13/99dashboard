'use client'

import { AlertTriangle, BarChart3, Copy, DollarSign, ExternalLink, Heart, MessageCircleQuestion, Send, Star, ThumbsDown, Trophy, UserCheck, UserX, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { brl, dt } from '@/lib/utils'
import {
  effortTag,
  moneyShort,
  nextActionFor,
  priceOf,
  reactionLabel,
  reactionsOf,
  riskTag,
  scoreOf,
  statusKind,
  workflowStatusLabel,
  workflowStatusOf,
} from './helpers'
import { ScoreBar, SignalDot } from './ui'
import type { OpenOpportunity, Opportunity, OpportunityAction, OpportunityReaction } from './types'

export function OpportunityTable({
  items,
  busy,
  onAction,
  onReact,
  onOpen,
}: {
  items: Opportunity[]
  busy: string
  onAction: OpportunityAction
  onReact: OpportunityReaction
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
      </div>
      {items.map((item) => (
        <TableRow key={item.source_project_id} item={item} busy={busy} onAction={onAction} onReact={onReact} onOpen={onOpen} />
      ))}
    </section>
  )
}

function TableRow({ item, busy, onAction, onReact, onOpen }: { item: Opportunity; busy: string; onAction: OpportunityAction; onReact: OpportunityReaction; onOpen: OpenOpportunity }) {
  const ds = item.decision_support || {}
  const status = workflowStatusOf(item)
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
        <button className="titleLink rowTitle" onClick={() => onOpen(String(item.source_project_id))}>
          {item.title}
        </button>
        <span className="nextAction">{nextActionFor(item)}</span>
        <ReactionChips item={item} />
      </div>
      <div data-label="Status">
        <span className={`chip ${statusKind(status)}`}>{workflowStatusLabel(item)}</span>
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
      <OpportunityActions item={item} busy={busy} copyProposal={copyProposal} onAction={onAction} onReact={onReact} onOpen={onOpen} />
    </article>
  )
}

export function OpportunityActions({
  item,
  busy,
  copyProposal,
  onAction,
  onReact,
  onOpen,
}: {
  item: Opportunity
  busy: string
  copyProposal: () => void
  onAction: OpportunityAction
  onReact: OpportunityReaction
  onOpen: OpenOpportunity
}) {
  const activeReactions = reactionsOf(item)
  const isActive = (reaction: string) => activeReactions.includes(reaction)

  return (
    <div className="rowActions">
      <div className="actionGroup statusGroup" aria-label="Mudar status">
        <span>Status</span>
        <Button
          className="iconAction"
          variant="primary"
          disabled={busy.includes(item.source_project_id)}
          onClick={() => onAction(item, 'proposal_sent', 'Abel enviou proposta ao cliente')}
          title="Marcar proposta enviada"
          aria-label="Marcar proposta enviada"
        >
          <Send size={15} />
        </Button>
        <Button className="iconAction" onClick={() => onAction(item, 'questions_sent', 'Abel enviou perguntas ao cliente; aguardando respostas')} title="Marcar perguntas enviadas" aria-label="Marcar perguntas enviadas">
          <MessageCircleQuestion size={15} />
        </Button>
        <Button className="iconAction" variant="danger" onClick={() => onAction(item, 'discarded', 'Abel descartou a oportunidade')} title="Descartar oportunidade" aria-label="Descartar oportunidade">
          <ThumbsDown size={15} />
        </Button>
        <Button className="iconAction" variant="danger" onClick={() => onAction(item, 'lost', 'Projeto perdido/cancelado', 'lost')} title="Marcar como perdido" aria-label="Marcar como perdido">
          <XCircle size={15} />
        </Button>
        <Button className="iconAction successAction" onClick={() => onAction(item, 'won', 'Projeto ganho', 'won')} title="Marcar como ganho" aria-label="Marcar como ganho">
          <Trophy size={15} />
        </Button>
      </div>
      <div className="actionGroup reactionGroup" aria-label="Reação">
        <span>Reação</span>
        <Button className={`iconAction ${isActive('liked') ? 'activeReaction' : ''}`} onClick={() => onReact(item, 'liked')} title="Gostei" aria-label="Gostei">
          <Heart size={15} />
        </Button>
        <Button className={`iconAction ${isActive('high_priority') ? 'activeReaction' : ''}`} onClick={() => onReact(item, 'high_priority')} title="Alta prioridade" aria-label="Alta prioridade">
          <Star size={15} />
        </Button>
        <Button className={`iconAction ${isActive('attractive_price') ? 'activeReaction' : ''}`} onClick={() => onReact(item, 'attractive_price')} title="Preço atrativo" aria-label="Preço atrativo">
          <DollarSign size={15} />
        </Button>
        <Button className={`iconAction ${isActive('unclear_scope') ? 'activeReaction' : ''}`} onClick={() => onReact(item, 'unclear_scope')} title="Escopo confuso" aria-label="Escopo confuso">
          <AlertTriangle size={15} />
        </Button>
        <Button className={`iconAction ${isActive('good_client') ? 'activeReaction' : ''}`} onClick={() => onReact(item, 'good_client')} title="Cliente bom" aria-label="Cliente bom">
          <UserCheck size={15} />
        </Button>
        <Button className={`iconAction ${isActive('risky_client') ? 'activeReaction' : ''}`} onClick={() => onReact(item, 'risky_client')} title="Cliente duvidoso" aria-label="Cliente duvidoso">
          <UserX size={15} />
        </Button>
      </div>
      <div className="actionGroup toolGroup" aria-label="Ferramentas">
        <span>Ferramentas</span>
        <Button className="iconAction" onClick={copyProposal} title="Copiar proposta" aria-label="Copiar proposta">
          <Copy size={15} />
        </Button>
        <Button className="iconAction" onClick={() => onOpen(String(item.source_project_id))} title="Analisar no Match Analytics" aria-label="Analisar no Match Analytics">
          <BarChart3 size={15} />
        </Button>
      </div>
      {item.project_url && (
        <div className="actionGroup linkGroup" aria-label="Links">
          <span>Link</span>
          <a className="btn secondary iconAction" target="_blank" href={item.project_url} title="Abrir projeto no 99Freelas" aria-label="Abrir projeto no 99Freelas">
            <ExternalLink size={15} />
          </a>
        </div>
      )}
    </div>
  )
}

export function OpportunityCard({ item, busy, onAction, onReact, onOpen }: { item: Opportunity; busy: string; onAction: OpportunityAction; onReact: OpportunityReaction; onOpen: OpenOpportunity }) {
  const ds = item.decision_support || {}
  const pd = item.page_details || {}
  const status = workflowStatusOf(item)
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
          <button className="titleLink title" onClick={() => onOpen(String(item.source_project_id))}>
            {item.title}
          </button>
        </div>
        <div className="score">{item.analysis?.final_score || 0}</div>
      </div>
      <p className="summary">
        {(item.full_description || item.description_preview || '').slice(0, 240)}
        {(item.full_description || '').length > 240 ? '…' : ''}
      </p>
      <div className="chips">
        <span className={`chip ${statusKind(status)}`}>{workflowStatusLabel(item)}</span>
        <ReactionChips item={item} />
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
        <OpportunityActions item={item} busy={busy} copyProposal={copyProposal} onAction={onAction} onReact={onReact} onOpen={onOpen} />
      </div>
    </article>
  )
}

function ReactionChips({ item }: { item: Opportunity }) {
  const reactions = reactionsOf(item)
  if (!reactions.length) return null
  return (
    <span className="reactionChips">
      {reactions.map((reaction) => (
        <span className="reactionChip" key={reaction}>{reactionLabel(reaction)}</span>
      ))}
    </span>
  )
}
