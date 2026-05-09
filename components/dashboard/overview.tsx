'use client'

import { Button } from '@/components/ui/button'
import {
  moneyShort,
  nextActionFor,
  priceOf,
  riskTag,
  scoreBand,
  scoreOf,
  statusKind,
  topTerms,
  workflowStatusOf,
} from './helpers'
import { MiniStat, Panel, ScoreBar } from './ui'
import type { Opportunity } from './types'

export function Overview({ items, onOpen }: { items: Opportunity[]; onOpen: (id: string) => void }) {
  const total = items.length
  const active = items.filter((item) => !['lost', 'discarded'].includes(workflowStatusOf(item)))
  const potential = active.reduce((sum, item) => sum + priceOf(item), 0)
  const top = [...active].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, 4)
  const champion = top[0]
  const championScore = champion ? scoreOf(champion) : 0
  const [championBand, championKind] = scoreBand(championScore)
  const avgScore = Math.round(items.reduce((sum, item) => sum + scoreOf(item), 0) / Math.max(total, 1))
  const strong = items.filter((item) => scoreOf(item) >= 75).length
  const ready = items.filter((item) => ['prepare_proposal', 'liked'].includes(workflowStatusOf(item))).length
  const statusFlow: [string, number][] = [
    ['Não revisado', items.filter((item) => workflowStatusOf(item) === 'new').length],
    ['Perguntas', items.filter((item) => workflowStatusOf(item) === 'questions_sent').length],
    ['Preparar', ready],
    ['Enviadas', items.filter((item) => workflowStatusOf(item) === 'proposal_sent').length],
    ['Fora', items.filter((item) => ['lost', 'discarded'].includes(workflowStatusOf(item))).length],
  ]
  const scoreBuckets: [string, string, number][] = [
    ['Fraco', '0-39', items.filter((item) => scoreOf(item) < 40).length],
    ['Morno', '40-59', items.filter((item) => scoreOf(item) >= 40 && scoreOf(item) < 60).length],
    ['Bom', '60-74', items.filter((item) => scoreOf(item) >= 60 && scoreOf(item) < 75).length],
    ['Forte', '75+', strong],
  ]
  const terms = topTerms(items, 10)
  const maxPrice = Math.max(...active.map(priceOf), 1)

  return (
    <>
      <section className="insightHero glass">
        <div className="heroMain">
          <span className={`signalBadge ${championKind}`}>
            {champion ? `Melhor score ${championScore} · ${championBand}` : 'Sem dados'}
          </span>
          <h2>{champion ? champion.title : 'Sem oportunidades carregadas'}</h2>
          <p>
            {champion
              ? `${strong ? `${strong} oportunidade(s) acima de 75.` : 'Ainda não há match forte acima de 75.'} Prioridade atual: ${moneyShort(priceOf(champion))}, ${riskTag(champion.decision_support || {}).toLowerCase()}, ${nextActionFor(champion).toLowerCase()}.`
              : 'Rode uma importação ou atualização para alimentar os sinais visuais.'}
          </p>
          {champion && (
            <Button variant="primary" onClick={() => onOpen(String(champion.source_project_id))}>
              Abrir análise
            </Button>
          )}
        </div>
        <div className="heroDial" style={{ '--value': avgScore } as any}>
          <b>{avgScore}</b>
          <span>score médio</span>
        </div>
        <div className="heroStats">
          <MiniStat label="Potencial ativo" value={moneyShort(potential)} tone="ok" />
          <MiniStat label="Preparar envio" value={ready} tone="warn" />
          <MiniStat label="Projetos ativos" value={active.length} tone="" />
        </div>
      </section>

      <section className="visualGrid">
        <Panel title="Funil de decisão">
          <div className="funnel compact">
            {statusFlow.map(([label, value], index) => (
              <div key={label} className={`funnelStep s${index}`}>
                <b>{value}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Qualidade do pipeline">
          <div className="scoreBuckets labeled">
            {scoreBuckets.map(([name, label, value]) => (
              <div key={label}>
                <strong>{name}</strong>
                <span>{label}</span>
                <i style={{ height: `${Math.max(8, (value / Math.max(total, 1)) * 100)}%` }} />
                <b>{value}</b>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Valor x match">
          <div className="scatterPlot">
            <em className="quad good">alto valor / bom match</em>
            <em className="quad check">validar preço</em>
            {active.slice(0, 28).map((item, index) => (
              <button
                key={item.source_project_id}
                title={`${item.title} · score ${scoreOf(item)} · ${moneyShort(priceOf(item))}`}
                onClick={() => onOpen(String(item.source_project_id))}
                className={statusKind(workflowStatusOf(item))}
                style={{
                  left: `${Math.min(92, Math.max(6, scoreOf(item) + ((index % 5) - 2) * 1.8))}%`,
                  bottom: `${Math.min(88, Math.max(8, (priceOf(item) / maxPrice) * 82))}%`,
                }}
              />
            ))}
            <span className="axis x">match →</span>
            <span className="axis y">valor ↑</span>
          </div>
        </Panel>

        <Panel title="Top matches">
          {top.map((item) => (
            <button className="visualMatch" key={item.source_project_id} onClick={() => onOpen(String(item.source_project_id))}>
              <ScoreBar value={scoreOf(item)} />
              <div>
                <b>{item.title}</b>
                <span>
                  {moneyShort(priceOf(item))} · {nextActionFor(item)}
                </span>
              </div>
              <em>{scoreOf(item)}</em>
            </button>
          ))}
        </Panel>

        <Panel title="Demanda recorrente">
          <div className="termCloud">
            {terms.map(([term, count]) => (
              <span key={term} style={{ '--weight': Math.min(1.35, 0.88 + count / 10) } as any}>
                {term}
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="Próxima ação">
          <div className="actionTiles">
            {['Revisar', 'Aguardar resposta', 'Preparar envio', 'Acompanhar', 'Arquivado'].map((label) => (
              <div key={label}>
                <b>{items.filter((item) => nextActionFor(item) === label).length}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </>
  )
}
