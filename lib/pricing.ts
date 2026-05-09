import type { Opportunity } from './domain'
import { openAIJson } from './ai/openai'
import { getAppSettings, type AppSettings } from './settings'

function has(text: string, terms: string[]) { const t = text.toLowerCase(); return terms.some(x => t.includes(x.toLowerCase())) }
function roundMoney(v: number, step = 500) { return Math.max(step, Math.round(v / step) * step) }
function brl(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }
function delivery(hoursMin: number, hoursMax: number) { const a=Math.max(2, Math.round(hoursMin/6)); const b=Math.max(a+2, Math.round(hoursMax/5)); return `${a} a ${b} dias úteis` }

function heuristic(item: Opportunity, settings: AppSettings) {
  const text = `${item.title}\n${item.full_description || item.description_preview || ''}`.toLowerCase()
  let hoursMin=20, hoursMax=60, risk=0.25, note='Estimativa genérica: precisa validar escopo.'
  let status='review'
  if (has(text, ['contabilidade digital', 'portal logado'])) { hoursMin=90; hoursMax=220; risk=0.35; note='MVP web com autenticação, portal, admin, documentos, integrações, segurança e deploy.'; status='prepare_proposal' }
  else if (has(text, ['landing page'])) { hoursMin=24; hoursMax=70; risk=0.25; note='Landing depende de conteúdo, responsividade, acabamento e formulário/SEO básico.'; status='prepare_proposal' }
  else if (has(text, ['n8n','asaas','webhook','pix','cartão','nota fiscal','api'])) { hoursMin=35; hoursMax=90; risk=0.30; note='Integração/automações com discovery, credenciais, webhooks, homologação e erros.'; status='prepare_proposal' }
  else if (has(text, ['marketplace','intermediação de serviços','getninja','prestador'])) { hoursMin=140; hoursMax=300; risk=0.40; note='Marketplace deve ser vendido por fase; estimativa para MVP controlado.'; status='prepare_proposal' }
  else if (has(text, ['loja','e-commerce','ecommerce','checkout'])) { hoursMin=45; hoursMax=110; risk=0.30; note='Loja depende de catálogo, checkout, meios de pagamento e conteúdo.'; status='prepare_proposal' }
  else if (has(text, ['site','website','institucional','página'])) { hoursMin=24; hoursMax=70; risk=0.25; note='Website varia conforme páginas, conteúdo, formulário e acabamento.'; status='prepare_proposal' }
  else if (has(text, ['aplicativo',' app ','mobile','android','ios'])) { hoursMin=70; hoursMax=180; risk=0.35; note='App inclui telas, fluxo, integração, testes e publicação/ambiente.'; status='prepare_proposal' }
  else if (has(text, ['python','script','pipeline','data warehouse','sql','nosql'])) { hoursMin=30; hoursMax=90; risk=0.30; note='Scripts/dados dependem de fontes, tratamento de erro, agendamento e documentação.'; status='prepare_proposal' }
  if (has(text, ['wordpress','woocommerce','plugin','erro crítico','migração wordpress','seo técnico'])) status='discarded'
  if (has(text, ['bac bo','cassino','aposta'])) { status='review'; risk += 0.15; note += ' Atenção: aposta/cassino é caso a caso.' }
  if (has(text, ['aberto','a combinar','sistema completo'])) { hoursMax=Math.round(hoursMax*1.25); risk += 0.1; note += ' Escopo vago: acrescentei risco.' }
  return pricing(item, { hours_min: hoursMin, hours_max: hoursMax, risk_pct: risk, pricing_note: note, status_manual: status, questions_to_client: defaultQuestions(item), source: 'heuristic' }, settings)
}

function defaultQuestions(item: Opportunity) {
  const title = item.title.toLowerCase(); const desc=(item.full_description||'').toLowerCase(); const text=title+' '+desc
  if (has(text, ['contabilidade digital','portal logado'])) return ['Quais módulos entram obrigatoriamente no MVP?', 'Quais ferramentas externas serão integradas no início?', 'Quais perfis de acesso existirão?', 'Os documentos terão controle de acesso e histórico?', 'Os fluxos operacionais já estão desenhados?']
  if (has(text, ['landing page'])) return ['O layout está em Figma/PDF/imagem?', 'A entrega precisa ser em alguma plataforma específica?', 'Textos, imagens e links já estão finais?', 'Há formulário, tracking ou integração?', 'Quem fará ajustes de conteúdo depois?']
  return ['Quais entregáveis entram obrigatoriamente no MVP?', 'Já existe ambiente/código/contas de APIs?', 'Qual prazo esperado e orçamento disponível?', 'Quais integrações são indispensáveis?', 'O que fica fora da primeira versão?']
}

function pricing(item: Opportunity, est: any, settings: AppSettings) {
  const hourlyRate = Number(settings.hourly_rate || 130)
  const fee = Number(settings.platform_fee_pct || 0.2)
  const avg=(est.hours_min+est.hours_max)/2
  const netMin=est.hours_min*hourlyRate*(1+Math.max(est.risk_pct-0.1,0))
  const net=avg*hourlyRate*(1+est.risk_pct)
  const netMax=est.hours_max*hourlyRate*(1+est.risk_pct+0.15)
  const priceMin=roundMoney(netMin/(1-fee)); const price=roundMoney(net/(1-fee)); const priceMax=roundMoney(netMax/(1-fee))
  const decision_support = {
    status_manual: est.status_manual || 'review', price_min: priceMin, price_suggested: price, price_max: priceMax,
    price_suggested_effective: price, effort_estimate: est.effort_estimate || 'a confirmar', delivery_estimate: est.delivery_estimate || delivery(est.hours_min, est.hours_max),
    pricing_note: `${est.pricing_note} Cálculo: ${est.hours_min}–${est.hours_max}h × R$ ${hourlyRate}/h + ${Math.round(est.risk_pct*100)}% risco ÷ ${(1-fee).toFixed(2)}. Líquido alvo: ${brl(roundMoney(net))}.`,
    pricing_calc: { source: est.source, model: est.model, hourly_rate: hourlyRate, platform_fee_pct: fee, hours_min: est.hours_min, hours_max: est.hours_max, hours_avg: Math.round(avg*10)/10, risk_pct: est.risk_pct, net_target_suggested: roundMoney(net) },
    questions_to_client: est.questions_to_client || defaultQuestions(item),
    proposal_draft: proposal(item, price, est), ai_pricing: est.ai_pricing,
  }
  const score = item.analysis?.final_score || scoreOpportunity(item)
  return { ...item, analysis: { ...(item.analysis||{}), final_score: score }, decision_support, effective_status: decision_support.status_manual, effective_status_label: label(decision_support.status_manual) }
}
function label(s:string){return ({review:'Revisar',prepare_proposal:'Preparar proposta',discarded:'Descartado',liked:'Gostei',lost:'Perdeu',proposal_sent:'Proposta enviada'} as any)[s] || s}
function scoreOpportunity(item: Opportunity){ const t=`${item.title} ${item.full_description||''}`.toLowerCase(); let s=50; if(has(t,['app','mobile','site','web','node','react'])) s+=15; if(has(t,['wordpress','cassino','aposta'])) s-=20; if((item.full_description||'').length>600) s+=10; return Math.max(0,Math.min(100,s)) }
function proposal(item: Opportunity, price: number, est: any){ return `Olá! Li o projeto "${item.title}" e posso ajudar com uma entrega bem delimitada.\n\nMinha sugestão é começarmos pelo MVP/escopo principal, validando requisitos, integrações, segurança, desenvolvimento, testes e deploy.\n\nPrazo estimado: ${est.delivery_estimate || delivery(est.hours_min, est.hours_max)}.\nInvestimento de referência: a partir de ${brl(price)}, ajustável conforme o escopo final.\n\nAntes de fechar, gostaria de confirmar alguns pontos para evitar orçamento errado e garantir uma entrega segura.` }

async function aiEstimate(item: Opportunity, base: Opportunity, settings: AppSettings) {
  if (!settings.ai_pricing_enabled || !settings.openai_api_key) return null
  const hourlyRate = Number(settings.hourly_rate || 130)
  const fee = Number(settings.platform_fee_pct || 0.2)
  const prompt = `Você é consultor técnico/comercial do Abel. Estime horas e preço para este projeto 99Freelas.\nRegras: valor-hora R$ ${hourlyRate}; taxa plataforma ${Math.round(fee*100)}%; preço ao cliente = líquido / ${(1-fee).toFixed(2)}.\nNão copie a heurística; decomponha mentalmente riscos, funcionalidades, tecnologia, integrações, segurança, deploy, testes e comunicação.\nResponda JSON: {"hours_min":number,"hours_max":number,"risk_pct":number,"effort_estimate":"string","delivery_estimate":"string","pricing_note":"string","questions_to_client":["..."],"risks":["..."],"status_manual":"review|prepare_proposal|discarded"}.\nHeurística de referência: ${JSON.stringify(base.decision_support?.pricing_calc)}\nProjeto: ${JSON.stringify({title:item.title,category:item.category,budget:item.budget,description:item.full_description})}`
  return openAIJson<any>(prompt, { model: settings.ai_pricing_model, apiKey: settings.openai_api_key })
}

export async function enrichOpportunity(item: Opportunity) {
  const settings = await getAppSettings()
  const base = heuristic(item, settings)
  try {
    const ai = await aiEstimate(item, base, settings)
    if (!ai) return { ...base, decision_support: { ...base.decision_support, ai_pricing: { enabled: settings.ai_pricing_enabled, used: false } } }
    return pricing(item, { ...ai, source: 'ai', model: settings.ai_pricing_model, ai_pricing: { enabled:true, used:true, model: settings.ai_pricing_model, risks: ai.risks || [] } }, settings)
  } catch (e:any) {
    return { ...base, decision_support: { ...base.decision_support, ai_pricing: { enabled:true, used:false, error:e.message } } }
  }
}
