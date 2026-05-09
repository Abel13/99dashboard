import { brl } from '@/lib/utils'
import { reactionLabels, statuses } from './constants'
import type { Opportunity } from './types'

export function fmtDate(value?: string) {
  if (!value) return 'Nunca'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function words(text = '') {
  return text.toLowerCase().match(/[a-záàâãéêíóôõúç0-9+#.]{3,}/g) || []
}

export function topTerms(items: Opportunity[], limit = 8) {
  const stop = new Set(
    'para com uma que por como dos das mais projeto sistema cliente precisa preciso precisando será criar fazer esta este voce você pelo pela dentro sobre todos onde qual quais profissional desenvolvedor configurar ajuste ajustes busca busco quero tenho tenho fazer via app'.split(' ')
  )
  const map = new Map<string, number>()

  items.forEach((item) => {
    words(`${item.title} ${item.full_description || ''}`).forEach((word) => {
      if (!stop.has(word)) map.set(word, (map.get(word) || 0) + 1)
    })
  })

  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
}

export function statusKind(status: string) {
  if (['liked', 'won', 'proposal_sent'].includes(status)) return 'ok'
  if (['lost', 'discarded', 'descartar'].includes(status)) return 'bad'
  if (['questions_sent', 'review', 'prepare_proposal', 'preparar_proposta', 'caso_a_caso'].includes(status)) return 'warn'
  return ''
}

export function scoreOf(item: Opportunity) {
  return Number(item.analysis?.final_score || 0)
}

export function priceOf(item: Opportunity) {
  return Number(item.decision_support?.price_suggested_effective ?? item.decision_support?.price_suggested ?? 0)
}

export function statusOf(item: Opportunity) {
  return item.effective_status || item.decision_support?.status_manual || 'review'
}

export function workflowStatusOf(item: Opportunity) {
  const raw = statusOf(item)
  const feedbackReason = String(item.abel_feedback?.reason || '').toLowerCase()

  if (raw === 'review' && feedbackReason.includes('perguntas')) return 'questions_sent'
  if (['review', 'caso_a_caso', 'liked'].includes(raw)) return 'new'
  if (raw === 'preparar_proposta') return 'prepare_proposal'
  if (raw === 'descartar') return 'discarded'
  return raw
}

export function scoreBand(score: number): [string, string] {
  if (score >= 75) return ['Forte', 'ok']
  if (score >= 60) return ['Bom', 'warn']
  if (score >= 40) return ['Morno', '']
  return ['Fraco', 'bad']
}

export function nextActionFor(item: Opportunity) {
  const status = workflowStatusOf(item)
  if (status === 'new') return 'Revisar'
  if (status === 'questions_sent') return 'Aguardar resposta'
  if (['prepare_proposal', 'liked'].includes(status)) return 'Preparar envio'
  if (status === 'proposal_sent') return 'Acompanhar'
  if (['discarded', 'lost'].includes(status)) return 'Arquivado'
  return 'Revisar'
}

export function statusLabel(status: string) {
  return statuses.find(([id]) => id === status)?.[1] || status
}

export function workflowStatusLabel(item: Opportunity) {
  return statusLabel(workflowStatusOf(item))
}

export function reactionsOf(item: Opportunity) {
  const reactions = new Set<string>(item.abel_feedback?.reactions || [])
  if (statusOf(item) === 'liked') reactions.add('liked')
  return [...reactions]
}

export function reactionLabel(reaction: string) {
  return reactionLabels[reaction] || reaction
}

export function effortTag(decisionSupport: any) {
  const hours = Number(decisionSupport.pricing_calc?.hours_avg || 0)
  if (!hours) return 'Esforço ?'
  if (hours < 32) return 'Baixo'
  if (hours < 80) return 'Médio'
  if (hours < 160) return 'Alto'
  return 'Enterprise'
}

export function riskTag(decisionSupport: any) {
  const risk = Number(decisionSupport.pricing_calc?.risk_pct || 0)
  if (!risk) return 'Risco ?'
  if (risk < 0.25) return 'Risco baixo'
  if (risk < 0.38) return 'Risco médio'
  return 'Risco alto'
}

export function moneyShort(value: any) {
  const n = Number(value || 0)
  if (!n) return '—'
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`.replace('.', ',')
  return brl(n)
}
