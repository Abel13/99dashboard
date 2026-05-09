import { NextRequest, NextResponse } from 'next/server'
import { getOpportunities } from '@/lib/softwarehouse'

const MODEL = process.env.CHAT_AI_MODEL || process.env.AI_PRICING_MODEL || 'gpt-4o-mini'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

function fallback(item: any) {
  const ds = item.decision_support || {}
  const calc = ds.pricing_calc || {}
  return {
    technical_requirements: ds.questions_to_client || ['Validar escopo funcional', 'Confirmar integrações', 'Definir ambiente de deploy', 'Planejar testes e homologação'],
    complexity_label: 'Médio',
    complexity_score: Math.min(100, Math.max(15, Number(calc.hours_avg || 50) / 2)),
    pricing_basis: ds.pricing_note || 'Estimativa baseada na régua atual de horas, risco e taxa da plataforma.',
    duration_estimate: ds.delivery_estimate || 'A confirmar',
    proposal_angle: 'Entrar com escopo fechado, separando MVP de evoluções futuras.',
    client_reputation: 'Sem dados reputacionais suficientes no dashboard. Verificar perfil, histórico, avaliações, clareza do briefing e velocidade de resposta antes de enviar proposta.',
    risks: ds.ai_pricing?.risks || ['Escopo pode mudar após alinhamento', 'Integrações podem exigir credenciais/documentação', 'Prazo depende de respostas do cliente'],
  }
}

export async function POST(req: NextRequest) {
  const { projectId } = await req.json()
  if (!projectId) return NextResponse.json({ error: 'projectId obrigatório' }, { status: 400 })
  const data = await getOpportunities()
  const item = data.items.find((i: any) => String(i.source_project_id) === String(projectId))
  if (!item) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
  if (!OPENAI_API_KEY) return NextResponse.json({ insight: fallback(item), fallback: true })

  const prompt = `Você é Oracle, consultora técnica/comercial do Softwarehouse. Gere um painel analítico para o projeto 99Freelas abaixo.
Responda SOMENTE JSON válido no formato:
{
  "technical_requirements":["..."],
  "complexity_label":"Correção simples|Pequeno|Médio|Alto|Complexidade empresarial",
  "complexity_score":0-100,
  "pricing_basis":"base objetiva de preço",
  "duration_estimate":"estimativa de duração",
  "proposal_angle":"como posicionar a proposta",
  "client_reputation":"análise reputacional com os dados disponíveis e o que verificar",
  "risks":["..."]
}
Considere funcionalidades, tecnologia, integrações, segurança, deploy, testes, clareza, concorrência e risco comercial.
Projeto: ${JSON.stringify(item).slice(0, 12000)}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, temperature: 0.25, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) return NextResponse.json({ insight: fallback(item), fallback: true, error: await res.text() })
  const json = await res.json()
  try { return NextResponse.json({ insight: JSON.parse(json.choices?.[0]?.message?.content || '{}') }) }
  catch { return NextResponse.json({ insight: fallback(item), fallback: true }) }
}
