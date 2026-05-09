'use client'

import { Banknote, CalendarCheck2, ChevronLeft, ChevronRight, ClipboardList, Database, Eye, Loader2, Sparkles, Tag, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  effortTag,
  fmtDate,
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
  const [savingProposal, setSavingProposal] = useState(false)
  const [proposalDraft, setProposalDraft] = useState('')
  const orderedItems = useMemo(
    () => [...items].sort((a, b) => compareProjectId(a.source_project_id, b.source_project_id)),
    [items]
  )

  if (!selected) return <div className="empty glass">Nenhum projeto selecionado.</div>

  const current: Opportunity = localSelected && String(localSelected.source_project_id) === String(selected.source_project_id) ? localSelected : selected
  const currentIndex = Math.max(0, orderedItems.findIndex((item) => String(item.source_project_id) === String(current.source_project_id)))
  const previous = orderedItems[currentIndex - 1]
  const next = orderedItems[currentIndex + 1]
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
  const requirements = ds.requirements_breakdown || insight?.requirements_breakdown || []
  const requirementsHours = requirements.reduce((sum: number, row: any) => sum + ((Number(row.hours_min || 0) + Number(row.hours_max || 0)) / 2), 0)
  const requirementsNet = requirements.reduce((sum: number, row: any) => sum + Number(row.net_value || 0), 0)
  const platformFee = Number(calc.platform_fee_pct || 0.2)
  const grossFromRequirements = platformFee < 1 ? requirementsNet / (1 - platformFee) : requirementsNet

  useEffect(() => {
    setProposalDraft(current.decision_support?.proposal_draft || '')
  }, [current.source_project_id, current.decision_support?.proposal_draft])

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
    await navigator.clipboard.writeText(proposalDraft || ds.proposal_draft || '')
  }

  async function saveProposal() {
    setSavingProposal(true)
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: current.source_project_id, proposal_draft: proposalDraft, runPipeline: false }),
    })
    if (response.ok) {
      const updated = { ...current, abel_feedback: { ...(current.abel_feedback || {}), proposal_draft: proposalDraft }, decision_support: { ...ds, proposal_draft: proposalDraft } }
      setLocalSelected(updated)
      onProjectUpdated?.(updated)
    }
    setSavingProposal(false)
  }

  function navigateTo(projectId?: string | number) {
    if (!projectId) return
    setSelectedId(String(projectId))
    setLocalSelected(null)
  }

  return (
    <>
      <section className="matchNav glass">
        <div className="projectStepper" aria-label="Navegação por projetos">
          <Button className="iconAction" onClick={() => navigateTo(previous?.source_project_id)} disabled={!previous} title="Projeto anterior" aria-label="Projeto anterior">
            <ChevronLeft size={16} />
          </Button>
          <div className="projectPosition">
            <b>#{current.source_project_id}</b>
            <span>{orderedItems.length ? `${currentIndex + 1} de ${orderedItems.length}` : '0 de 0'} · ordem por ID</span>
          </div>
          <Button className="iconAction" onClick={() => navigateTo(next?.source_project_id)} disabled={!next} title="Próximo projeto" aria-label="Próximo projeto">
            <ChevronRight size={16} />
          </Button>
        </div>
        <select className="select projectSelect" value={String(current.source_project_id)} onChange={(event) => navigateTo(event.target.value)} aria-label="Selecionar projeto">
          {orderedItems.map((item) => (
            <option key={item.source_project_id} value={item.source_project_id}>
              #{item.source_project_id} · {item.title}
            </option>
          ))}
        </select>
        <div className="matchNavActions">
          <Button onClick={enrichCurrentProject} disabled={enriching || !current.project_url}>
            {enriching ? <Loader2 className="loadingIcon" size={15} /> : <Database size={15} />}
            {current.page_details?.enriched_at ? 'Atualizar 99Freelas' : 'Enriquecer 99Freelas'}
          </Button>
          <Button variant="primary" onClick={generateInsight} disabled={loading}>
            {loading ? <Loader2 className="loadingIcon" size={15} /> : <Sparkles size={15} />}
            Atualizar IA
          </Button>
        </div>
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
          <div className="freelasSnapshot">
            <div className="freelasMainMetric budget">
              <Banknote size={20} />
              <span>Orçamento</span>
              <b>{current.page_details?.budget || current.budget || '—'}</b>
              <small>mínimo {current.page_details?.minimum_value || '—'}</small>
            </div>
            <div className="freelasMainMetric">
              <ClipboardList size={20} />
              <span>Propostas</span>
              <b>{current.page_details?.proposals ?? '—'}</b>
              <small>{current.page_details?.visibility || 'visibilidade não informada'}</small>
            </div>
            <div className="freelasMainMetric">
              <Users size={20} />
              <span>Interessados</span>
              <b>{current.page_details?.interested ?? '—'}</b>
              <small>{current.page_details?.level || current.level || 'nível não informado'}</small>
            </div>
          </div>
          <div className="freelasMetaGrid">
            <VisualFact icon={<Tag size={16} />} label="Projeto" value={`#${current.source_project_id}`} detail={current.category || current.page_details?.subcategory || '99Freelas'} />
            <VisualFact icon={<Eye size={16} />} label="Status" value={current.page_details?.project_status_99freelas || '—'} detail={`Workflow: ${workflowStatusLabel(selected)}`} />
            <VisualFact icon={<CalendarCheck2 size={16} />} label="Dados" value={fmtMaybe(current.page_details?.enriched_at)} detail={`IA: ${fmtMaybe(current.match_insight_generated_at)}`} />
          </div>
          <div className="descriptionBox">
            <div className="descriptionMeta">
              <b>Descrição completa</b>
              <span>{current.full_description ? `${projectDescription.length} caracteres importados` : 'prévia importada'}</span>
            </div>
            <div className="summary fullDescription">{formatDescriptionForView(projectDescription).map((block, index) => block.startsWith('•') ? <p key={index} className="descriptionBullet">{block}</p> : <p key={index}>{block}</p>)}</div>
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
              <Button onClick={copyProposal}>Copiar proposta</Button>
            </div>
          </div>
          <RequirementTable requirements={requirements} hours={requirementsHours} net={requirementsNet} gross={grossFromRequirements} fee={platformFee} />
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

        <Panel title="Proposta editável">
          <span className="sectionSource app">Origem: rascunho comercial revisável</span>
          <textarea className="textarea proposalEditor" value={proposalDraft} onChange={(event) => setProposalDraft(event.target.value)} placeholder="Gere ou escreva uma proposta para copiar ao 99Freelas." />
          <div className="proposalActions">
            <Button onClick={saveProposal} disabled={savingProposal}>{savingProposal ? <Loader2 className="loadingIcon" size={15} /> : null}Salvar proposta</Button>
            <Button variant="primary" onClick={copyProposal}>Copiar proposta</Button>
          </div>
        </Panel>
      </section>
    </>
  )
}

function fmtMaybe(value?: string) {
  return value ? fmtDate(value) : '—'
}

function formatDescriptionForView(text: string) {
  return text
    .replace(/\r/g, '')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
}

function RequirementTable({ requirements, hours, net, gross, fee }: { requirements: any[]; hours: number; net: number; gross: number; fee: number }) {
  if (!requirements.length) return <p className="summary">Sem tabela de requisitos ainda. Atualize a análise/enriquecimento para gerar a decomposição.</p>
  return (
    <div className="requirementTableWrap">
      <h4>Análise de requisitos, tempo e valor</h4>
      <div className="requirementTable">
        <div className="requirementHead"><span>Requisito</span><span>Horas</span><span>Líquido</span></div>
        {requirements.map((row: any, index: number) => (
          <div className="requirementRow" key={`${row.requirement}-${index}`}>
            <span>{row.requirement}</span>
            <b>{row.hours_min ?? '—'}–{row.hours_max ?? '—'}h</b>
            <b>{moneyShort(row.net_value || 0)}</b>
          </div>
        ))}
        <div className="requirementTotal">
          <span>Total médio</span>
          <b>{Math.round(hours)}h</b>
          <b>{moneyShort(net)}</b>
        </div>
        <div className="requirementTotal gross">
          <span>Preço ao cliente com taxa ({Math.round(fee * 100)}%)</span>
          <b>—</b>
          <b>{moneyShort(gross)}</b>
        </div>
      </div>
    </div>
  )
}

function VisualFact({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: any; detail?: string }) {
  return (
    <div className="visualFact">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
        {detail && <em>{detail}</em>}
      </div>
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

function compareProjectId(a: string | number, b: string | number) {
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true })
}
