import { NextResponse } from 'next/server'
import { getOpportunities, readImportState } from '@/lib/softwarehouse'
import { getAppSettings } from '@/lib/settings'

function terms(items: any[]) {
  const stop = new Set('para com uma que por como dos das mais projeto sistema cliente precisa será criar desenvolvimento aplicação aplicativo site web mobile integração dados fazer esta este voce você pelo pela dentro sobre todos onde qual quais'.split(' '))
  const map = new Map<string, number>()
  for (const item of items) {
    const text = `${item.title || ''} ${item.full_description || item.description_preview || ''}`.toLowerCase()
    for (const w of text.match(/[a-záàâãéêíóôõúç0-9+#.]{3,}/g) || []) {
      if (!stop.has(w)) map.set(w, (map.get(w) || 0) + 1)
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([skill, demand]) => ({ skill, demand }))
}

function fallback(items: any[]) {
  const demand = terms(items)
  const mapped = demand.map((x) => x.skill)
  const suggestions = [
    mapped.includes('supabase') ? null : 'Supabase/PostgreSQL para MVPs rápidos',
    mapped.includes('webhook') || mapped.includes('api') ? 'Integrações API/Webhooks com tratamento de falhas' : null,
    mapped.includes('asaas') || mapped.includes('pix') ? 'Pagamentos: Asaas, Pix, cartões e conciliação' : null,
    mapped.includes('mobile') || mapped.includes('android') || mapped.includes('ios') ? 'Publicação e arquitetura mobile multiplataforma' : null,
    mapped.includes('dashboard') || mapped.includes('relatório') ? 'Dashboards, BI leve e relatórios operacionais' : null,
    'Deploy seguro em VPS/Docker com monitoramento básico',
  ].filter(Boolean)
  return { source: 'fallback', demand_terms: demand, suggestions: suggestions.map((name, idx) => ({ name, priority: idx < 2 ? 'alta' : 'média', reason: 'Sinal recorrente nas oportunidades atuais.', action: 'Adicionar ao perfil se houver domínio real e evidência de entrega.' })) }
}

export async function GET() {
  const settings = await getAppSettings()
  const [{ items }, state] = await Promise.all([getOpportunities(), readImportState()])
  const profile = state.profile_data || null
  const compact = items.slice(0, 60).map((i: any) => ({
    id: i.source_project_id,
    title: i.title,
    status: i.effective_status || i.decision_support?.status_manual,
    score: i.analysis?.final_score,
    category: i.category,
    price: i.decision_support?.price_suggested_effective ?? i.decision_support?.price_suggested,
    description: (i.full_description || i.description_preview || '').slice(0, 900),
  }))

  if (!settings.openai_api_key) return NextResponse.json({ ok: true, ...fallback(items) })

  const prompt = `Você é Oracle, IA interna do dashboard 99Freelas. Sugira melhorias para o perfil público do Abel com base no perfil importado e nas oportunidades reais.
Compare o que o perfil comunica com os termos, riscos e demandas dos melhores projetos. Não sugira habilidades genéricas demais. Priorize mudanças que aumentem conversão, ticket e confiança.
Responda JSON válido:
{"source":"ai","demand_terms":[{"skill":"...","demand":number}],"suggestions":[{"name":"...","priority":"alta|média|baixa","reason":"...","action":"como aprender/posicionar no perfil"}]}
Contexto: ${JSON.stringify({ profile_username: settings.profile_username, hourly_rate: settings.hourly_rate, profile, opportunities: compact }).slice(0, 16000)}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${settings.openai_api_key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: settings.chat_ai_model || settings.ai_pricing_model || 'gpt-4o-mini', temperature: 0.25, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) return NextResponse.json({ ok: true, ...fallback(items), ai_error: await res.text() })
  const json = await res.json()
  try { return NextResponse.json({ ok: true, ...JSON.parse(json.choices?.[0]?.message?.content || '{}') }) }
  catch { return NextResponse.json({ ok: true, ...fallback(items) }) }
}
