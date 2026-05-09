'use client'

import { ClipboardList, Database, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  effortTag,
  moneyShort,
  nextActionFor,
  riskTag,
  scoreBand,
  scoreOf,
  workflowStatusLabel,
} from './helpers'
import { Complexity, Panel, ScoreBar, Signal } from './ui'
import { OpportunityActions } from './opportunity-list'
import type { OpenOpportunity, Opportunity, OpportunityAction, OpportunityReaction } from './types'

export function MatchAnalytics({
  items,
  selected,
  selectedId,
  setSelectedId,
  busy,
  onAction,
  onReact,
  onOpen,
  onProjectUpdated,
}: {
  items: Opportunity[]
  selected: Opportunity
  selectedId: string
  setSelectedId: (value: string) => void
  busy: string
  onAction: OpportunityAction
  onReact: OpportunityReaction
  onOpen: OpenOpportunity
  onProjectUpdated?: (item: Opportunity) => void
}) {
  const [localSelected, setLocalSelected] = useState<Opportunity | null>(null)
  const [loading, setLoading] = useState(false)
  const [enriching, setEnriching] = useState(false)

  if (!selected) return <div className="empty glass">Nenhum projeto selecionado.</div>

  const current: Opportunity = localSelected && String(localSelected.source_project_id) === String(selected.source_project_id) ? localSelected : selected
  const insight = current.match_insight || null
  const ds = current.decision_support || {}
  const calc = ds.pricing_calc || {}
  const price = ds.price_suggested_effective ?? ds.price_suggested
  const risk = Math.round(Number(calc.risk_pct || 0) * 100)
  const hoursAvg = Math.round(Number(calc.hours_avg || 0))
  const complexity = insight?.complexity_score ?? Math.min(100, Number(calc.hours_avg || 50) / 2)
  const score = scoreOf(current)
  const [band, bandKind] = scoreBand(score)
  const aiEnabled = Boolean(insight || ds.ai_pricing?.used)
  const questions = (insight?.technical_requirements || ds.questions_to_client || []).slice(0, 5)
  const risks = (insight?.risks || ds.ai_pricing?.risks || ['Escopo, integrações e acesso a ambientes precisam ser confirmados.']).slice(0, 5)
  const projectDescription = current.full_description || current.description_preview || 'Sem descrição importada.'

  async function generateInsight() {
    setLoading(true)
    const response = await fetch('/api/project-insight', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: current.source_project_id }),
    })
    const data = await response.json()
    if (data.item) {
      setLocalSelected(data.item)
      onProjectUpdated?.(data.item)
    }
    setLoading(false)
  }

  async function enrichCurrentProject() {
    setEnriching(true)
    const response = await fetch('/api/enrich/project', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: current.source_project_id }),
    })
    const data = await response.json().catch(() => ({}))
    if (data.item) {
      setLocalSelected(data.item)
      onProjectUpdated?.(data.item)
    }
    setEnriching(false)
  }

  async function copyProposal() {
    await navigator.clipboard.writeText(ds.proposal_draft || '')
  }

  return (
    <>
      <section className="toolbar glass">
        <select
          className="select"
          value={selectedId}
          onChange={(event) => {
            setSelectedId(event.target.value)
            setLocalSelected(null)
          }}
        >
          {items.map((item) => (
            <option key={item.source_project_id} value={item.source_project_id}>
              #{item.source_project_id} · {item.title}
            </option>
          ))}
        </select>
        <Button onClick={enrichCurrentProject} disabled={enriching || !current.project_url}>
          {enriching ? <Loader2 className="loadingIcon" size={15} /> : <Database size={15} />}
          {current.page_details?.enriched_at ? 'Atualizar dados 99Freelas' : 'Enriquecer dados 99Freelas'}
        </Button>
        <Button variant="primary" onClick={generateInsight} disabled={loading}>
          {loading ? <Loader2 className="loadingIcon" size={15} /> : <Sparkles size={15} />}
          Atualizar painel IA
        </Button>
      </section>

      <section className="analysisHeader glass">
        <div>
          <span className={`signalBadge ${bandKind}`}>{band} match</span>
          <h2>{current.title}</h2>
          <div className="sourceBadges">
            <span><Database size={14} /> 99Freelas</span>
            <span><ClipboardList size={14} /> Análise da aplicação</span>
            {aiEnabled && <span><Sparkles size={14} /> IA</span>}
          </div>
        </div>
        <div className="decisionPrice">
          <span>preço sugerido</span>
          <b>{moneyShort(price)}</b>
          <small>{moneyShort(calc.net_target_suggested)} líquido</small>
        </div>
      </section>

      <section className="nextStepPanel glass">
        <div>
          <span className="sectionSource app">O que fazer agora</span>
          <h3>{nextActionFor(selected)}</h3>
          <p>{actionCopy(nextActionFor(selected))}</p>
        </div>
        <div className="nextStepMetrics">
          <Signal label="Score" value={score} suffix="/100" kind={bandKind} />
          <Signal label="Risco" value={risk || 0} suffix="%" kind={risk > 38 ? 'bad' : risk > 24 ? 'warn' : 'ok'} />
          <Signal label="Horas" value={hoursAvg || 0} suffix="h" kind={hoursAvg > 120 ? 'bad' : hoursAvg > 64 ? 'warn' : 'ok'} />
        </div>
        <div className="analyticsActions">
          <OpportunityActions item={current} busy={busy} copyProposal={copyProposal} onAction={onAction} onReact={onReact} onOpen={onOpen} />
        </div>
      </section>

      <section className="analysisSections">
        <Panel title="Dados do 99Freelas">
          <span className="sectionSource source99">Origem: projeto importado</span>
          <div className="factGrid">
            <Fact label="Projeto" value={`#${current.source_project_id}`} />
            <Fact label="Categoria" value={current.category || current.page_details?.subcategory || '—'} />
            <Fact label="Status atual" value={workflowStatusLabel(selected)} />
            <Fact label="Orçamento" value={current.page_details?.budget || current.budget || '—'} />
            <Fact label="Nível" value={current.page_details?.level || current.level || '—'} />
            <Fact label="Propostas" value={current.page_details?.proposals ?? '—'} />
            <Fact label="Interessados" value={current.page_details?.interested ?? '—'} />
            <Fact label="Valor mínimo" value={current.page_details?.minimum_value || '—'} />
            <Fact label="Visibilidade" value={current.page_details?.visibility || '—'} />
          </div>
          <div className="descriptionBox">
            <div className="descriptionMeta">
              <b>Descrição completa</b>
              <span>{current.full_description ? `${projectDescription.length} caracteres importados` : 'prévia importada'}</span>
            </div>
            <p className="summary fullDescription">{projectDescription}</p>
          </div>
        </Panel>

        <Panel title="Análise da aplicação">
          <span className="sectionSource app">Origem: regras, score e precificação local</span>
          <div className="analysisSplit">
            <div>
              <Complexity value={complexity} label={insight?.complexity_label || effortTag(ds)} />
              <div className="signalTiles compact">
                <div><b>{riskTag(ds)}</b><span>risco estimado</span></div>
                <div><b>{hoursAvg || '—'}h</b><span>média estimada</span></div>
              </div>
            </div>
            <div>
              <div className="priceBlock">
                <b>{moneyShort(price)}</b>
                <span>{`${calc.hours_min || '—'}-${calc.hours_max || '—'}h estimadas`}</span>
              </div>
              <ScoreBar value={Math.max(6, 100 - risk)} />
              <p className="summary shortText">{ds.pricing_note || 'Sem nota de precificação local.'}</p>
              <Button onClick={() => navigator.clipboard.writeText(ds.proposal_draft || '')}>Copiar proposta</Button>
            </div>
          </div>
        </Panel>

        <Panel title="Análise da IA">
          <span className="sectionSource ai">Origem: {aiEnabled ? 'modelo de IA / enriquecimento' : 'ainda não gerada para este projeto'}</span>
          {!aiEnabled && <p className="summary">Clique em <b>Atualizar painel IA</b> para gerar uma leitura específica deste projeto.</p>}
          {aiEnabled && (
            <div className="aiGrid">
              <div>
                <h4>Perguntas obrigatórias</h4>
                <ul className="softList compactList">{questions.map((item: string) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <h4>Riscos principais</h4>
                <ul className="softList compactList">{risks.map((item: string) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <h4>Cliente</h4>
                <p className="summary shortText"><b>{current.client_details?.name || 'Cliente não identificado'}</b>{current.client_details?.url && <> · <a target="_blank" href={current.client_details.url}>abrir perfil</a></>}</p>
                <div className="chips"><span className="chip">Nota {current.client_details?.rating ?? current.client_details?.score ?? '—'}</span><span className="chip">{current.client_details?.reviews ?? '—'} avaliações</span><span className="chip">{current.client_details?.completed_projects ?? '—'} projetos</span></div>
                <p className="summary shortText">{insight?.client_reputation || current.client_details?.about_preview || 'Sem reputação suficiente. Validar histórico, briefing, concorrência e velocidade de resposta.'}</p>
              </div>
              <div>
                <h4>Base de preço</h4>
                <p className="summary shortText">{insight?.pricing_basis || ds.ai_pricing?.proposal_summary || 'Sem explicação adicional da IA.'}</p>
              </div>
            </div>
          )}
        </Panel>
      </section>
    </>
  )
}

function Fact({ label, value }: { label: string; value: any }) {
  return (
    <div className="factItem">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function actionCopy(action: string) {
  if (action === 'Revisar') return 'Leia o escopo importado, confira riscos e decida se precisa enviar perguntas ao cliente.'
  if (action === 'Aguardar resposta') return 'Você já enviou perguntas. Aguarde retorno antes de fechar proposta ou preço.'
  if (action === 'Preparar envio') return 'A oportunidade parece pronta para proposta. Revise preço, prazo e copie o rascunho.'
  if (action === 'Acompanhar') return 'A proposta já foi enviada. Monitore retorno, negociação ou perda.'
  return 'O projeto está arquivado ou fora do fluxo ativo.'
}
