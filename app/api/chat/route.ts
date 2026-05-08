import { NextRequest, NextResponse } from 'next/server'
import { getOpportunities } from '@/lib/softwarehouse'

const MODEL = process.env.CHAT_AI_MODEL || process.env.AI_PRICING_MODEL || 'gpt-4o-mini'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }

function compactOpportunity(item: any) {
  const ds = item.decision_support || {}
  const calc = ds.pricing_calc || {}
  const pd = item.page_details || {}
  return {
    id: String(item.source_project_id || ''),
    title: item.title,
    status: item.effective_status || ds.status_manual,
    score: item.analysis?.final_score,
    price_suggested: ds.price_suggested_effective ?? ds.price_suggested,
    net_target: calc.net_target_suggested,
    hours_min: calc.hours_min,
    hours_max: calc.hours_max,
    risk_pct: calc.risk_pct,
    proposals: pd.proposals,
    interested: pd.interested,
    questions: ds.questions_to_client,
    pricing_note: ds.pricing_note,
    feedback: item.abel_feedback,
    description: (item.full_description || item.description_preview || '').slice(0, 1600),
  }
}

function systemPrompt(projects: any[]) {
  return `Você é Oracle, agente do Softwarehouse de Abel.

Tom e comportamento:
- Português simples, direto e caloroso.
- Calma, criteriosa, comercialmente esperta e técnica sem enrolar.
- Ajude Abel a decidir oportunidades 99Freelas: preço, prazo, esforço, riscos, perguntas e proposta.
- Não diga que "adivinha"; diga que identifica sinais.
- Quando parecer cilada, diga com calma e firmeza.
- Quando for viável, explique o que proteger no escopo.
- Não envie propostas automaticamente; apenas rascunhe/oriente.
- Prioridades de Abel: mobile multiplataforma, websites, software desktop.
- Aceita se pagar bem: backend, dados, agentes de IA, WordPress/Elementor só como landing simples/editável e bem delimitada.
- Tende a descartar: manutenção/migração/SEO técnico/plugin/erro crítico/WooCommerce/legado WordPress; apostas/cassino/automação de jogo salvo decisão explícita.
- Valor-hora: R$ 130/h. Taxa plataforma: 20%. Preço ao cliente deve considerar gross-up: líquido ÷ 0,80.

Use os projetos abaixo como contexto atual do dashboard. Se Abel mencionar um número, procure por id. Seja concisa por padrão.

Projetos atuais (JSON compacto):
${JSON.stringify(projects, null, 2)}`
}

export async function POST(req: NextRequest) {
  if (!OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })
  const body = await req.json()
  const messages = (body.messages || []) as ChatMessage[]
  const selectedProjectId = body.projectId ? String(body.projectId) : ''
  const data = await getOpportunities()
  let projects = data.items || []
  if (selectedProjectId) {
    const selected = projects.find((p: any) => String(p.source_project_id) === selectedProjectId)
    const others = projects.filter((p: any) => String(p.source_project_id) !== selectedProjectId).slice(0, 12)
    projects = selected ? [selected, ...others] : projects.slice(0, 15)
  } else {
    projects = projects.slice(0, 20)
  }

  const payload = {
    model: MODEL,
    temperature: 0.35,
    messages: [
      { role: 'system', content: systemPrompt(projects.map(compactOpportunity)) },
      ...messages.slice(-12).map(m => ({ role: m.role, content: m.content })),
    ],
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  const json = await res.json()
  return NextResponse.json({ message: json.choices?.[0]?.message?.content || 'Não consegui responder agora.' })
}
