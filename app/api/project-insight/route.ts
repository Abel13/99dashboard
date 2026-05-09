import { NextRequest, NextResponse } from 'next/server'
import { enrichProjectAndClient } from '@/lib/import/project-enricher'
import { enrichOpportunity } from '@/lib/pricing'
import { getOpportunityById, upsertOpportunity } from '@/lib/softwarehouse'
import { getAppSettings } from '@/lib/settings'

function safeClientName(name = '') {
  const clean = String(name || '').replace(/^#\s*/, '').trim()
  if (!clean || clean.length > 60 || /freelancer|proposta|aprovad|desenvolvedor|projeto|cliente não identificado/i.test(clean)) return ''
  return clean
}

function normalizeProposalDraft(value: any, item: any) {
  if (typeof value !== 'string' || !value.trim()) return ''
  let text = value.trim()
  if ((text.match(/\s\/\s/g) || []).length >= 3) {
    text = text.split(/\s\/\s/g).map(x => x.trim()).filter(Boolean).join('\n\n')
  }
  text = text
    .replace(/Minha sugestão (?:é|seria):\s*/i, 'Minha sugestão para o projeto seria:\n')
    .replace(/\s+-\s+/g, '\n- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const clientName = safeClientName(item.client_details?.name)
  if (clientName && /^Olá,?\s*tudo bem\?/i.test(text)) {
    text = text.replace(/^Olá,?\s*tudo bem\?/i, `Olá, ${clientName}. Tudo bem?`)
  }
  return text
}

const RECENT_SITE_IMPORT_MS = 30 * 60 * 1000

function hasRecentSiteImport(item: any) {
  const enrichedAt = item?.page_details?.enriched_at ? Date.parse(item.page_details.enriched_at) : 0
  const isProjectPage = item?.page_details?.source === 'project_page' || item?.page_details?.description_source === 'project_page'
  return Boolean(isProjectPage && enrichedAt && Date.now() - enrichedAt <= RECENT_SITE_IMPORT_MS)
}

async function canonicalItemForInsight(item: any) {
  if (hasRecentSiteImport(item)) return { item, refreshed: false }
  if (!item.project_url) return { item, refreshed: false }

  const pageEnriched = await enrichProjectAndClient(item)
  const priced = await enrichOpportunity(pageEnriched)
  const saved = await upsertOpportunity(priced)
  return { item: saved.payload || priced, refreshed: true }
}

function insightPayload(item: any) {
  return {
    source_project_id: item.source_project_id,
    title: item.title,
    project_url: item.project_url,
    category: item.page_details?.category || item.category,
    subcategory: item.page_details?.subcategory,
    budget: item.page_details?.budget || item.budget,
    level: item.page_details?.level || item.level,
    project_status_99freelas: item.page_details?.project_status_99freelas,
    description_source: item.page_details?.description_source,
    site_enriched_at: item.page_details?.enriched_at,
    full_description: item.full_description,
    client_details: item.client_details,
    page_details: item.page_details,
    decision_support: item.decision_support,
  }
}

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
  const dbItem = await getOpportunityById(String(projectId))
  if (!dbItem) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
  let canonical = dbItem
  let siteRefreshed = false
  try {
    const result = await canonicalItemForInsight(dbItem)
    canonical = result.item
    siteRefreshed = result.refreshed
  } catch (err: any) {
    canonical = { ...dbItem, match_insight_source_warning: `Falha ao atualizar dados do site antes da IA: ${err.message || String(err)}` }
  }
  const item = canonical
  const settings = await getAppSettings()
  if (!settings.openai_api_key) {
    const insight = fallback(item)
    const updated = { ...item, match_insight: insight, match_insight_generated_at: new Date().toISOString() }
    const saved = await upsertOpportunity(updated)
    return NextResponse.json({ insight, item: saved.payload || updated, fallback: true, siteRefreshed })
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
  "proposal_draft":"proposta comercial pronta para copiar, com parágrafos separados por quebras de linha reais e lista usando '- '. Nunca use '/' como separador. Estrutura: saudação; entendimento do problema; experiência relacionada; sugestão com lista; acompanhamento/validação; experiência prática; fechamento; obrigado.",
  "client_reputation":"análise reputacional com os dados disponíveis e o que verificar",
  "risks":["..."]
}
Considere funcionalidades, tecnologia, integrações, segurança, deploy, testes, clareza, concorrência e risco comercial.
Não invente nome do cliente: se o nome não estiver claro em client_details, diga que não foi identificado.
A proposta deve falar do pedido específico do cliente, seguir o padrão definido acima, usar quebras de linha reais, nunca usar '/' como separador e vender confiança/resultado; evite texto genérico como "vamos fazer um MVP" quando o cliente pediu outra coisa.
Use obrigatoriamente a descrição e os detalhes vindos da página do 99Freelas quando description_source/site_enriched_at indicarem project_page. Não use email_subject, description_preview ou prévia de e-mail como base se full_description do site estiver disponível.
Dados canônicos para análise: ${JSON.stringify(insightPayload(item)).slice(0, 14000)}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${settings.openai_api_key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: settings.chat_ai_model || settings.ai_pricing_model || 'gpt-4o-mini', temperature: 0.25, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) {
    const insight = fallback(item)
    const updated = { ...item, match_insight: insight, match_insight_generated_at: new Date().toISOString() }
    const saved = await upsertOpportunity(updated)
    return NextResponse.json({ insight, item: saved.payload || updated, fallback: true, siteRefreshed, error: await res.text() })
  }
  const json = await res.json()
  try {
    const insight = JSON.parse(json.choices?.[0]?.message?.content || '{}')
    const proposalDraft = normalizeProposalDraft(insight.proposal_draft, item)
    if (proposalDraft) insight.proposal_draft = proposalDraft
    const decision_support = proposalDraft ? { ...(item.decision_support || {}), proposal_draft: proposalDraft, requirements_breakdown: insight.requirements_breakdown || item.decision_support?.requirements_breakdown } : item.decision_support
    const updated = { ...item, decision_support, match_insight: insight, match_insight_generated_at: new Date().toISOString() }
    const saved = await upsertOpportunity(updated)
    return NextResponse.json({ insight, item: saved.payload || updated, siteRefreshed })
  }
  catch {
    const insight = fallback(item)
    const updated = { ...item, match_insight: insight, match_insight_generated_at: new Date().toISOString() }
    const saved = await upsertOpportunity(updated)
    return NextResponse.json({ insight, item: saved.payload || updated, fallback: true, siteRefreshed })
  }
}
