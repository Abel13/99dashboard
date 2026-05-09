import type { Opportunity } from './domain'
import { openAIJson } from './ai/openai'
import { getAppSettings, type AppSettings } from './settings'

function has(text: string, terms: string[]) { const t = text.toLowerCase(); return terms.some(x => t.includes(x.toLowerCase())) }
function roundMoney(v: number, step = 500) { return Math.max(step, Math.round(v / step) * step) }
function brl(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }
function delivery(hoursMin: number, hoursMax: number) { const a=Math.max(2, Math.round(hoursMin/6)); const b=Math.max(a+2, Math.round(hoursMax/5)); return `${a} a ${b} dias úteis` }
function assistedHours(hours: number) { return Math.max(6, Math.round(hours * 0.72)) }
function requirementBreakdown(item: Opportunity, hoursMin: number, hoursMax: number, settings: AppSettings, custom?: any[]) {
  if (Array.isArray(custom) && custom.length) return custom
  const text = `${item.title} ${item.full_description || item.description_preview || ''}`.toLowerCase()
  const items = [
    ['Alinhamento e escopo fechado', 4, 8],
    ['Arquitetura, setup e ambiente', 6, 14],
    ['Desenvolvimento funcional principal', Math.round(hoursMin * 0.38), Math.round(hoursMax * 0.42)],
    ['Integrações, dados e regras de negócio', Math.round(hoursMin * 0.18), Math.round(hoursMax * 0.22)],
    ['QA, ajustes, deploy e passagem', Math.round(hoursMin * 0.18), Math.round(hoursMax * 0.20)],
  ]
  if (has(text, ['landing page', 'institucional'])) items.splice(3, 1, ['Responsividade, formulário e acabamento visual', Math.round(hoursMin * 0.22), Math.round(hoursMax * 0.26)])
  if (has(text, ['api', 'webhook', 'asaas', 'pix', 'cartão'])) items.splice(3, 1, ['Integrações/API, webhooks e homologação', Math.round(hoursMin * 0.24), Math.round(hoursMax * 0.30)])
  const rate = Number(settings.hourly_rate || 130)
  return items.map(([name, min, max]) => ({
    requirement: String(name),
    hours_min: assistedHours(Number(min)),
    hours_max: assistedHours(Number(max)),
    net_value: roundMoney(((assistedHours(Number(min)) + assistedHours(Number(max))) / 2) * rate, 100),
  }))
}

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
  const rawHoursMin = Number(est.hours_min || 20)
  const rawHoursMax = Number(est.hours_max || rawHoursMin * 2)
  const hoursMin = assistedHours(rawHoursMin)
  const hoursMax = Math.max(hoursMin + 2, assistedHours(rawHoursMax))
  const avg=(hoursMin+hoursMax)/2
  const requirements = requirementBreakdown(item, hoursMin, hoursMax, settings, est.requirements_breakdown)
  const requirementsHours = requirements.reduce((sum: number, row: any) => sum + ((Number(row.hours_min || 0) + Number(row.hours_max || 0)) / 2), 0)
  const requirementsNet = requirements.reduce((sum: number, row: any) => sum + Number(row.net_value || 0), 0)
  const baseNet = requirementsNet || (avg*hourlyRate)
  const netMin=hoursMin*hourlyRate*(1+Math.max(est.risk_pct-0.1,0))
  const net=baseNet*(1+est.risk_pct)
  const netMax=hoursMax*hourlyRate*(1+est.risk_pct+0.15)
  const priceMin=roundMoney(netMin/(1-fee)); const price=roundMoney(net/(1-fee)); const priceMax=roundMoney(netMax/(1-fee))
  const decision_support = {
    status_manual: est.status_manual || 'review', price_min: priceMin, price_suggested: price, price_max: priceMax,
    price_suggested_effective: price, effort_estimate: est.effort_estimate || 'a confirmar', delivery_estimate: est.delivery_estimate || delivery(hoursMin, hoursMax),
    pricing_note: `${est.pricing_note} Cálculo já considera apoio de IA: ${hoursMin}–${hoursMax}h produtivas × R$ ${hourlyRate}/h + ${Math.round(est.risk_pct*100)}% risco ÷ ${(1-fee).toFixed(2)}. Líquido alvo: ${brl(roundMoney(net))}.`,
    pricing_calc: { source: est.source, model: est.model, hourly_rate: hourlyRate, platform_fee_pct: fee, ai_assisted: true, raw_hours_min: rawHoursMin, raw_hours_max: rawHoursMax, hours_min: hoursMin, hours_max: hoursMax, hours_avg: Math.round(avg*10)/10, requirements_hours_avg: Math.round(requirementsHours*10)/10, requirements_net_total: roundMoney(requirementsNet, 100), risk_pct: est.risk_pct, net_target_suggested: roundMoney(net), gross_target_suggested: price },
    requirements_breakdown: requirements,
    questions_to_client: est.questions_to_client || defaultQuestions(item),
    proposal_draft: est.proposal_draft || proposal(item, price, est), ai_pricing: est.ai_pricing,
  }
  const score = item.analysis?.final_score || scoreOpportunity(item)
  return { ...item, analysis: { ...(item.analysis||{}), final_score: score }, decision_support, effective_status: decision_support.status_manual, effective_status_label: label(decision_support.status_manual) }
}
function label(s:string){return ({review:'Revisar',prepare_proposal:'Preparar proposta',discarded:'Descartado',liked:'Gostei',lost:'Perdeu',proposal_sent:'Proposta enviada'} as any)[s] || s}
function scoreOpportunity(item: Opportunity){ const t=`${item.title} ${item.full_description||''}`.toLowerCase(); let s=50; if(has(t,['app','mobile','site','web','node','react'])) s+=15; if(has(t,['wordpress','cassino','aposta'])) s-=20; if((item.full_description||'').length>600) s+=10; return Math.max(0,Math.min(100,s)) }
function proposal(item: Opportunity, price: number, est: any){
  const desc = cleanForProposal(item.full_description || item.description_preview || '')
  const problem = summarizeProblem(item, desc)
  const tech = relatedExperience(item)
  const solutionStyle = solutionAdjectives(item)
  const benefit = mainBenefit(item)
  const deliveries = proposalDeliveries(item).slice(0, 4)
  const clientName = safeClientName(item.client_details?.name)
  const greeting = clientName ? `Olá, ${clientName}. Tudo bem?` : 'Olá, tudo bem?'
  return `${greeting}\n\nLi a descrição do projeto e entendi que você precisa de ${problem}.\n\nTenho experiência com ${tech} e posso te ajudar criando uma solução ${solutionStyle}, com foco em ${benefit}.\n\nMinha sugestão para o projeto seria:\n${deliveries.map(x => `- ${x}`).join('\n')}\n\nTambém posso te manter atualizado durante o desenvolvimento e entregar uma versão para validação antes da entrega final.\n\nTenho experiência prática com desenvolvimento de aplicações ${tech} e posso te mostrar exemplos do meu trabalho, se desejar.\n\nFico à disposição para conversar melhor sobre os detalhes.\nObrigado.`
}
function cleanForProposal(text = '') { return text.replace(/\s+/g, ' ').trim().slice(0, 260) }
function safeClientName(name = '') {
  const clean = name.trim()
  if (!clean || clean.length > 60 || /freelancer|proposta|aprovad|desenvolvedor|projeto/i.test(clean)) return ''
  return clean
}
function summarizeProblem(item: Opportunity, desc: string) {
  const text = `${item.title}. ${desc}`.toLowerCase()
  if (has(text, ['contabilidade digital'])) return 'uma plataforma web para organizar e digitalizar processos contábeis'
  if (has(text, ['landing page'])) return 'uma landing page clara, responsiva e preparada para conversão'
  if (has(text, ['site', 'website', 'institucional'])) return 'um site profissional para apresentar sua empresa e captar contatos'
  if (has(text, ['app', 'mobile', 'android', 'ios'])) return 'um aplicativo bem estruturado para atender seus usuários no celular'
  if (has(text, ['api', 'webhook', 'integração', 'asaas', 'pix'])) return 'uma integração confiável entre sistemas, com automações e tratamento de erros'
  if (has(text, ['desktop', 'sistema'])) return 'um sistema funcional e bem organizado para apoiar sua operação'
  return desc ? desc.charAt(0).toLowerCase() + desc.slice(1).replace(/[.?!]$/, '') : 'uma solução bem definida para o escopo descrito'
}
function relatedExperience(item: Opportunity) {
  const text = `${item.title} ${item.full_description || ''} ${item.category || ''}`.toLowerCase()
  if (has(text, ['mobile', 'app', 'android', 'ios'])) return 'aplicações mobile e integrações com backend'
  if (has(text, ['landing page', 'site', 'website', 'institucional'])) return 'desenvolvimento web, interfaces responsivas e páginas de conversão'
  if (has(text, ['api', 'webhook', 'asaas', 'pix', 'integração'])) return 'backend, APIs, webhooks e automações'
  if (has(text, ['desktop', 'genexus', 'sql'])) return 'sistemas desktop, banco de dados e configuração de ambientes'
  if (has(text, ['dados', 'dashboard', 'relatório', 'sql'])) return 'sistemas web, dados, dashboards e automações'
  return 'desenvolvimento de aplicações web e sistemas sob medida'
}
function solutionAdjectives(item: Opportunity) {
  const text = `${item.title} ${item.full_description || ''}`.toLowerCase()
  if (has(text, ['login', 'portal', 'cliente', 'documento'])) return 'segura, bem estruturada e fácil de evoluir'
  if (has(text, ['landing page', 'site'])) return 'moderna, responsiva e orientada à conversão'
  if (has(text, ['api', 'webhook', 'integração'])) return 'robusta, rastreável e preparada para falhas'
  return 'moderna, organizada e alinhada ao seu objetivo'
}
function mainBenefit(item: Opportunity) {
  const text = `${item.title} ${item.full_description || ''}`.toLowerCase()
  if (has(text, ['contabilidade', 'processo', 'portal'])) return 'reduzir trabalho manual e melhorar a experiência dos clientes'
  if (has(text, ['landing page', 'site'])) return 'passar credibilidade e gerar mais contatos'
  if (has(text, ['api', 'webhook', 'automação'])) return 'automatizar o fluxo e evitar retrabalho operacional'
  if (has(text, ['dashboard', 'relatório'])) return 'dar clareza aos dados e facilitar decisões'
  return 'entregar valor rápido com uma base técnica confiável'
}
function proposalDeliveries(item: Opportunity) {
  const text = `${item.title} ${item.full_description || ''}`.toLowerCase()
  if (has(text, ['landing page'])) return ['estruturação da página com seções claras e persuasivas', 'layout responsivo para desktop e celular', 'formulário/CTA e ajustes finais de publicação', 'orientação para futuras alterações de conteúdo']
  if (has(text, ['api', 'webhook', 'asaas', 'pix', 'integração'])) return ['mapeamento dos fluxos e regras da integração', 'implementação dos endpoints/webhooks necessários', 'tratamento de erros, logs e testes de homologação', 'documentação simples para operação e manutenção']
  if (has(text, ['mobile', 'app', 'android', 'ios'])) return ['definição dos fluxos principais do aplicativo', 'desenvolvimento das telas e navegação', 'integração com backend/APIs necessárias', 'versão para validação com testes básicos']
  if (has(text, ['contabilidade digital', 'portal'])) return ['estrutura do portal com perfis de acesso', 'fluxos principais para clientes e área administrativa', 'organização de documentos/dados conforme o escopo', 'validação guiada antes da entrega final']
  return ['alinhamento dos requisitos e escopo fechado', 'desenvolvimento da funcionalidade principal', 'testes e ajustes com base na validação', 'entrega organizada com orientação de uso']
}

async function aiEstimate(item: Opportunity, base: Opportunity, settings: AppSettings) {
  if (!settings.ai_pricing_enabled || !settings.openai_api_key) return null
  const hourlyRate = Number(settings.hourly_rate || 130)
  const fee = Number(settings.platform_fee_pct || 0.2)
  const prompt = `Você é consultor técnico/comercial do Abel. Estime horas e preço para este projeto 99Freelas.\nRegras: valor-hora R$ ${hourlyRate}; taxa plataforma ${Math.round(fee*100)}%; preço ao cliente = líquido / ${(1-fee).toFixed(2)}.\nNão copie a heurística; decomponha mentalmente riscos, funcionalidades, tecnologia, integrações, segurança, deploy, testes e comunicação.\nConsidere que Abel trabalha com auxílio de IA/coding assistants; estime horas produtivas realistas para esse contexto, não uma fábrica tradicional.\nResponda JSON: {"hours_min":number,"hours_max":number,"risk_pct":number,"effort_estimate":"string","delivery_estimate":"string","pricing_note":"string","proposal_angle":"string","proposal_draft":"string opcional seguindo exatamente este padrão: Olá, [nome se houver]. Tudo bem? / Li a descrição... / Tenho experiência... / Minha sugestão... / Também posso... / Tenho experiência prática... / Fico à disposição... / Obrigado.","requirements_breakdown":[{"requirement":"string","hours_min":number,"hours_max":number,"net_value":number}],"questions_to_client":["..."],"risks":["..."],"status_manual":"review|prepare_proposal|discarded"}.\nNão invente nome do cliente. Se não houver nome confiável, comece com "Olá, tudo bem?".\nHeurística de referência: ${JSON.stringify(base.decision_support?.pricing_calc)}\nProjeto: ${JSON.stringify({title:item.title,category:item.category,budget:item.budget,description:item.full_description})}`
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
