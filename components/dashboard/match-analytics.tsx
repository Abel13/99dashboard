'use client'

import { CheckCircle2, ClipboardList, Database, Loader2, Sparkles } from 'lucide-react'
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
import type { OpenOpportunity, Opportunity, OpportunityAction } from './types'

export function MatchAnalytics({
  items,
  selected,
  selectedId,
  setSelectedId,
  busy,
  onAction,
  onOpen,
}: {
  items: Opportunity[]
  selected: Opportunity
  selectedId: string
  setSelectedId: (value: string) => void
  busy: string
  onAction: OpportunityAction
  onOpen: OpenOpportunity
}) {
  const [insight, setInsight] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  if (!selected) return <div className="empty glass">Nenhum projeto selecionado.</div>

  const ds = selected.decision_support || {}
  const calc = ds.pricing_calc || {}
  const price = ds.price_suggested_effective ?? ds.price_suggested
  const risk = Math.round(Number(calc.risk_pct || 0) * 100)
  const hoursAvg = Math.round(Number(calc.hours_avg || 0))
  const complexity = insight?.complexity_score ?? Math.min(100, Number(calc.hours_avg || 50) / 2)
  const score = scoreOf(selected)
  const [band, bandKind] = scoreBand(score)
  const aiEnabled = Boolean(insight || ds.ai_pricing?.used)
  const questions = (insight?.technical_requirements || ds.questions_to_client || []).slice(0, 5)
  const risks = (insight?.risks || ds.ai_pricing?.risks || ['Escopo, integrações e acesso a ambientes precisam ser confirmados.']).slice(0, 5)

  async function generateInsight() {
    setLoading(true)
    const response = await fetch('/api/project-insight', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: selected.source_project_id }),
    })
    const data = await response.json()
    setInsight(data.insight)
    setLoading(false)
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
            setInsight(null)
          }}
        >
          {items.map((item) => (
            <option key={item.source_project_id} value={item.source_project_id}>
              #{item.source_project_id} · {item.title}
            </option>
          ))}
        </select>
        <Button variant="primary" onClick={generateInsight} disabled={loading}>
          {loading ? <Loader2 size={15} /> : <Sparkles size={15} />}
          Atualizar painel IA
        </Button>
      </section>

      <section className="analysisHeader glass">
        <div>
          <span className={`signalBadge ${bandKind}`}>{band} match</span>
          <h2>{selected.title}</h2>
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
          <OpportunityActions item={selected} busy={busy} copyProposal={copyProposal} onAction={onAction} onOpen={onOpen} />
        </div>
      </section>

      <section className="analysisSections">
        <Panel title="Dados do 99Freelas">
          <span className="sectionSource source99">Origem: projeto importado</span>
          <div className="factGrid">
            <Fact label="Projeto" value={`#${selected.source_project_id}`} />
            <Fact label="Categoria" value={selected.category || selected.page_details?.subcategory || '—'} />
            <Fact label="Status atual" value={workflowStatusLabel(selected)} />
            <Fact label="Orçamento" value={selected.page_details?.budget || selected.budget || '—'} />
            <Fact label="Nível" value={selected.page_details?.level || selected.level || '—'} />
            <Fact label="Propostas" value={selected.page_details?.proposals ?? '—'} />
            <Fact label="Interessados" value={selected.page_details?.interested ?? '—'} />
            <Fact label="Valor mínimo" value={selected.page_details?.minimum_value || '—'} />
            <Fact label="Visibilidade" value={selected.page_details?.visibility || '—'} />
          </div>
          <p className="summary sourceText">{(selected.full_description || selected.description_preview || 'Sem descrição importada.').slice(0, 520)}{(selected.full_description || '').length > 520 ? '…' : ''}</p>
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
                <p className="summary shortText"><b>{selected.client_details?.name || 'Cliente não identificado'}</b>{selected.client_details?.url && <> · <a target="_blank" href={selected.client_details.url}>abrir perfil</a></>}</p>
                <div className="chips"><span className="chip">Nota {selected.client_details?.rating ?? selected.client_details?.score ?? '—'}</span><span className="chip">{selected.client_details?.reviews ?? '—'} avaliações</span><span className="chip">{selected.client_details?.completed_projects ?? '—'} projetos</span></div>
                <p className="summary shortText">{insight?.client_reputation || selected.client_details?.about_preview || 'Sem reputação suficiente. Validar histórico, briefing, concorrência e velocidade de resposta.'}</p>
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
