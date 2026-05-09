import { NextRequest, NextResponse } from 'next/server'
import { getOpportunities, upsertOpportunity } from '@/lib/softwarehouse'
import { getAppSettings } from '@/lib/settings'

function fallback(item: any) {
  const ds = item.decision_support || {}
  const calc = ds.pricing_calc || {}
  return {
    technical_requirements: ds.questions_to_client || ['Validar escopo funcional', 'Confirmar integrações', 'Definir ambiente de deploy', 'Planejar testes e homologação'],
    complexity_label: 'Médio',
    complexity_score: Math.min(100, Math.max(15, Number(calc.hours_avg || 50) / 2)),
    pricing_basis: ds.pricing_note || 'Estimativa baseada na régua atual de horas, risco, auxílio de IA e taxa da plataforma.',
    duration_estimate: ds.delivery_estimate || 'A confirmar',
    requirements_breakdown: ds.requirements_breakdown || [],
    proposal_angle: 'Entrar com escopo fechado e proposta conectada ao problema descrito pelo cliente.',
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
  const settings = await getAppSettings()
  if (!settings.openai_api_key) {
    const insight = fallback(item)
    const updated = { ...item, match_insight: insight, match_insight_generated_at: new Date().toISOString() }
    const saved = await upsertOpportunity(updated)
    return NextResponse.json({ insight, item: saved.payload || updated, fallback: true })
  }

  const prompt = `Você é Oracle, consultora técnica/comercial do Softwarehouse. Gere um painel analítico para o projeto 99Freelas abaixo.
Responda SOMENTE JSON válido no formato:
{
  "technical_requirements":["..."],
  "complexity_label":"Correção simples|Pequeno|Médio|Alto|Complexidade empresarial",
  "complexity_score":0-100,
  "pricing_basis":"base objetiva de preço considerando auxílio de IA/coding assistant",
  "duration_estimate":"estimativa de duração",
  "requirements_breakdown":[{"requirement":"requisito/entregável","hours_min":0,"hours_max":0,"net_value":0}],
  "proposal_angle":"como posicionar a proposta de forma vendível e específica ao pedido",
  "proposal_draft":"proposta comercial pronta para copiar seguindo este padrão: Olá, [nome se houver]. Tudo bem? / Li a descrição do projeto e entendi que você precisa de... / Tenho experiência com... / Minha sugestão seria: - entrega 1 - entrega 2 - entrega 3 - diferencial / Também posso te manter atualizado... / Tenho experiência prática... / Fico à disposição... Obrigado.",
  "client_reputation":"análise reputacional com os dados disponíveis e o que verificar",},{
  "risks":["..."]
}
Considere funcionalidades, tecnologia, integrações, segurança, deploy, testes, clareza, concorrência e risco comercial.
Não invente nome do cliente: se o nome não estiver claro em client_details, diga que não foi identificado.
A proposta deve falar do pedido específico do cliente, seguir o padrão definido acima e vender confiança/resultado; evite texto genérico como "vamos fazer um MVP" quando o cliente pediu outra coisa.
Projeto: ${JSON.stringify(item).slice(0, 12000)}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${settings.openai_api_key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: settings.chat_ai_model || settings.ai_pricing_model || 'gpt-4o-mini', temperature: 0.25, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) {
    const insight = fallback(item)
    const updated = { ...item, match_insight: insight, match_insight_generated_at: new Date().toISOString() }
    const saved = await upsertOpportunity(updated)
    return NextResponse.json({ insight, item: saved.payload || updated, fallback: true, error: await res.text() })
  }
  const json = await res.json()
  try {
    const insight = JSON.parse(json.choices?.[0]?.message?.content || '{}')
    const decision_support = insight.proposal_draft ? { ...(item.decision_support || {}), proposal_draft: insight.proposal_draft, requirements_breakdown: insight.requirements_breakdown || item.decision_support?.requirements_breakdown } : item.decision_support
    const updated = { ...item, decision_support, match_insight: insight, match_insight_generated_at: new Date().toISOString() }
    const saved = await upsertOpportunity(updated)
    return NextResponse.json({ insight, item: saved.payload || updated })
  }
  catch {
    const insight = fallback(item)
    const updated = { ...item, match_insight: insight, match_insight_generated_at: new Date().toISOString() }
    const saved = await upsertOpportunity(updated)
    return NextResponse.json({ insight, item: saved.payload || updated, fallback: true })
  }
}
