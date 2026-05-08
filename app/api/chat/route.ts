import { NextRequest, NextResponse } from 'next/server'
import { getOpportunities } from '@/lib/softwarehouse'

const MODEL = process.env.CHAT_AI_MODEL || process.env.AI_PRICING_MODEL || 'gpt-4o-mini'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }

function compactOpportunity(item: any, detailed = false) {
  const ds = item.decision_support || {}
  const calc = ds.pricing_calc || {}
  const pd = item.page_details || {}
  return {
    id: String(item.source_project_id || ''),
    title: item.title,
    status: item.effective_status || ds.status_manual,
    score: item.analysis?.final_score,
    category: item.category,
    budget: item.budget,
    competition: { proposals: pd.proposals, interested: pd.interested },
    heuristic_reference_do_not_copy: {
      price_suggested: ds.price_suggested_effective ?? ds.price_suggested,
      net_target: calc.net_target_suggested,
      hours_min: calc.hours_min,
      hours_max: calc.hours_max,
      risk_pct: calc.risk_pct,
      pricing_note: ds.pricing_note,
    },
    existing_questions: ds.questions_to_client,
    feedback: item.abel_feedback,
    description: (item.full_description || item.description_preview || '').slice(0, detailed ? 6500 : 1400),
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

Regra crítica de raciocínio:
- Os campos em "heuristic_reference_do_not_copy" são apenas uma referência do sistema antigo.
- NÃO copie esses números como resposta final quando Abel pedir cálculo de horas, preço, esforço ou prazo.
- Você deve fazer uma estimativa própria a partir da descrição do projeto.
- Se sua estimativa coincidir com a heurística, diga explicitamente por quê.
- Se discordar, diga que discorda e mostre a nova faixa.

Quando Abel pedir horas/estimativa/preço, responda obrigatoriamente com:
1. Leitura curta do escopo real.
2. Quebra por blocos de trabalho em tabela Markdown: bloco, horas mín, horas máx, observação.
3. Total de horas mín/máx e horas sugeridas.
4. Cálculo líquido: horas sugeridas × R$ 130/h + margem de risco.
5. Preço ao cliente com taxa: líquido ÷ 0,80.
6. Principais riscos que podem aumentar horas.
7. Perguntas que reduziriam incerteza.

Use os projetos abaixo como contexto atual do dashboard. Se Abel mencionar um número, procure por id. Seja concisa por padrão, mas mostre raciocínio suficiente quando for cálculo.

Projetos atuais (JSON compacto):
${JSON.stringify(projects, null, 2)}`
}

function looksLikeEstimationRequest(messages: ChatMessage[]) {
  const last = messages[messages.length - 1]?.content?.toLowerCase() || ''
  return /(hora|horas|estimar|estimativa|calcular|cálculo|preço|precificar|prazo|esforço|esforco)/i.test(last)
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
    const others = projects.filter((p: any) => String(p.source_project_id) !== selectedProjectId).slice(0, 8)
    projects = selected ? [selected, ...others] : projects.slice(0, 12)
  } else {
    projects = projects.slice(0, 18)
  }

  const estimationNudge = looksLikeEstimationRequest(messages)
    ? [{ role: 'system', content: 'Esta é uma pergunta de estimativa. Faça decomposição nova por blocos. Não responda apenas repetindo hours_min/hours_max do JSON.' }]
    : []

  const payload = {
    model: MODEL,
    temperature: 0.45,
    messages: [
      { role: 'system', content: systemPrompt(projects.map((p: any, idx: number) => compactOpportunity(p, idx === 0 && !!selectedProjectId))) },
      ...estimationNudge,
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
