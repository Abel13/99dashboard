'use client'

import { BarChart3, Gauge, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  effortTag,
  moneyShort,
  nextActionFor,
  riskTag,
  scoreBand,
  scoreOf,
} from './helpers'
import { Complexity, Metric, Panel, ScoreBar, Signal } from './ui'
import type { Opportunity } from './types'

export function MatchAnalytics({
  items,
  selected,
  selectedId,
  setSelectedId,
}: {
  items: Opportunity[]
  selected: Opportunity
  selectedId: string
  setSelectedId: (value: string) => void
}) {
  const [insight, setInsight] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  if (!selected) return <div className="empty glass">Nenhum projeto selecionado.</div>

  const ds = selected.decision_support || {}
  const calc = ds.pricing_calc || {}
  const price = ds.price_suggested_effective ?? ds.price_suggested
  const risk = Math.round(Number(calc.risk_pct || 0) * 100)
  const hoursAvg = Math.round(Number(calc.hours_avg || 0))
  const score = scoreOf(selected)
  const [band, bandKind] = scoreBand(score)

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

      <section className="decisionHero glass">
        <div>
          <span className={`signalBadge ${bandKind}`}>{band} match</span>
          <h2>{selected.title}</h2>
          <div className="visualSignals">
            <Signal label="Score" value={score} suffix="/100" kind={bandKind} />
            <Signal label="Risco" value={risk || 0} suffix="%" kind={risk > 38 ? 'bad' : risk > 24 ? 'warn' : 'ok'} />
            <Signal label="Horas" value={hoursAvg || 0} suffix="h" kind={hoursAvg > 120 ? 'bad' : hoursAvg > 64 ? 'warn' : 'ok'} />
          </div>
        </div>
        <div className="decisionPrice">
          <span>preço sugerido</span>
          <b>{moneyShort(price)}</b>
          <small>{moneyShort(calc.net_target_suggested)} líquido</small>
        </div>
      </section>

      <section className="decisionBoard">
        <div className="decisionCard glass">
          <Gauge size={20} />
          <span>Próxima ação</span>
          <b>{nextActionFor(selected)}</b>
        </div>
        <div className="decisionCard glass">
          <Sparkles size={20} />
          <span>Base</span>
          <b>{ds.ai_pricing?.used ? 'IA + heurística' : 'Heurística'}</b>
        </div>
        <div className="decisionCard glass">
          <BarChart3 size={20} />
          <span>Prazo</span>
          <b>{ds.delivery_estimate || insight?.duration_estimate || 'A confirmar'}</b>
        </div>
      </section>

      <section className="visualGrid analysisGrid">
        <Panel title="Complexidade técnica">
          <Complexity value={insight?.complexity_score ?? Math.min(100, Number(calc.hours_avg || 50) / 2)} label={insight?.complexity_label || effortTag(ds)} />
          <div className="signalTiles">
            <div>
              <b>{riskTag(ds)}</b>
              <span>risco comercial/técnico</span>
            </div>
            <div>
              <b>{hoursAvg || '—'}h</b>
              <span>média estimada</span>
            </div>
          </div>
        </Panel>

        <Panel title="Preço x esforço">
          <div className="priceBlock">
            <b>{moneyShort(price)}</b>
            <span>{`${calc.hours_min || '—'}-${calc.hours_max || '—'}h estimadas`}</span>
          </div>
          <ScoreBar value={Math.max(6, 100 - risk)} />
          <p className="summary shortText">{insight?.pricing_basis || ds.pricing_note || 'Sem base registrada.'}</p>
          <Button onClick={() => navigator.clipboard.writeText(ds.proposal_draft || '')}>Copiar proposta</Button>
        </Panel>

        <Panel title="Perguntas obrigatórias">
          <ul className="softList compactList">
            {(insight?.technical_requirements || ds.questions_to_client || []).slice(0, 5).map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Panel>

        <Panel title="Riscos principais">
          <ul className="softList compactList">
            {(insight?.risks || ds.ai_pricing?.risks || ['Escopo, integrações e acesso a ambientes precisam ser confirmados.']).slice(0, 5).map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Panel>

        <Panel title="Cliente">
          <p className="summary shortText">
            {insight?.client_reputation || 'Sem reputação suficiente. Validar histórico, briefing, concorrência e velocidade de resposta.'}
          </p>
        </Panel>

        <Panel title="Resumo">
          <p className="summary shortText">
            {(selected.full_description || selected.description_preview || '').slice(0, 360)}
            {(selected.full_description || '').length > 360 ? '…' : ''}
          </p>
        </Panel>
      </section>
    </>
  )
}
