'use client'
import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Heart, LayoutGrid, List, Loader2, RefreshCw, Send, ThumbsDown, XCircle } from 'lucide-react'
import { brl, dt } from '@/lib/utils'
import { useDashboardStore } from '@/store/dashboard-store'
import { Button } from './ui/button'
import { ThemeToggle } from './theme-toggle'
import { OracleChat } from './oracle-chat'

type Opportunity = any
const statuses = [
  ['new','Novo'],['review','Revisar'],['liked','Gostei'],['discarded','Descartado'],['prepare_proposal','Preparar proposta'],['proposal_sent','Proposta enviada'],['won','Ganhou'],['lost','Perdeu'],['preparar_proposta','Preparar proposta (sug.)'],['caso_a_caso','Caso a caso'],['descartar','Descartar (sug.)']
]
function statusKind(status:string){ if(['liked','won','proposal_sent'].includes(status)) return 'ok'; if(['lost','discarded','descartar'].includes(status)) return 'bad'; if(['review','prepare_proposal','preparar_proposta','caso_a_caso'].includes(status)) return 'warn'; return '' }
export function Dashboard(){
  const [items,setItems]=useState<Opportunity[]>([]); const [status,setStatus]=useState<any>(null); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(''); const [toast,setToast]=useState('')
  const [view,setView]=useState<'list'|'cards'>('list')
  const {query,minScore,statuses:activeStatuses,setQuery,setMinScore,toggleStatus,clearStatuses}=useDashboardStore()
  async function load(){setLoading(true); const [r,s]=await Promise.all([fetch('/api/opportunities',{cache:'no-store'}), fetch('/api/status',{cache:'no-store'})]); const data=await r.json(); setItems(data.items||[]); if(s.ok) setStatus(await s.json()); setLoading(false)}
  useEffect(()=>{load()},[])
  async function runPipeline(){setBusy('pipeline'); const r=await fetch('/api/pipeline',{method:'POST'}); setBusy(''); setToast(r.ok?'Pipeline atualizado':'Erro ao atualizar pipeline'); await load()}
  async function action(item:Opportunity,status:string,reason:string,outcome?:string){setBusy(item.source_project_id+status); const r=await fetch('/api/feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:item.source_project_id,status,reason,outcome})}); setBusy(''); setToast(r.ok?'Status salvo e dashboard regenerado':'Erro ao salvar status'); await load()}
  const filtered=useMemo(()=>items.filter(i=>{const q=(query||'').toLowerCase(); const text=`${i.title} ${i.full_description||''} ${i.effective_status||''}`.toLowerCase(); const score=Number(i.analysis?.final_score||0); const st=i.effective_status||i.decision_support?.status_manual||'review'; return (!q||text.includes(q)) && score>=minScore && (!activeStatuses.length||activeStatuses.includes(st))}),[items,query,minScore,activeStatuses])
  const metrics=useMemo(()=>({total:items.length, visible:filtered.length, proposals:items.filter(i=>i.decision_support?.proposal_draft).length, avg:Math.round(items.reduce((s,i)=>s+Number(i.analysis?.final_score||0),0)/Math.max(items.length,1))}),[items,filtered])
  const chatProjects = useMemo(() => items.map(i => ({ id: String(i.source_project_id), title: i.title })), [items])
  return <main className="container">
    <section className="topbar"><div><span className="kicker">Oracle · Softwarehouse</span><h1>99Dashboard</h1></div><div className="topActions"><ThemeToggle/><Button variant="primary" onClick={runPipeline} disabled={!!busy}>{busy==='pipeline'?<Loader2 size={16}/>:<RefreshCw size={16}/>} Atualizar</Button></div></section>
    <section className="metrics"><div className="metric glass"><span>Total</span><b>{metrics.total}</b></div><div className="metric glass"><span>Visíveis</span><b>{metrics.visible}</b></div><div className="metric glass"><span>Com proposta</span><b>{metrics.proposals}</b></div><div className="metric glass"><span>Score médio</span><b>{metrics.avg}</b></div></section>
    <StatusStrip status={status}/>
    <section className="toolbar glass">
      <input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por título, descrição ou status..."/>
      <select className="select" value={minScore} onChange={e=>setMinScore(Number(e.target.value))}><option value={0}>Qualquer score</option><option value={40}>Score &gt;= 40</option><option value={60}>Score &gt;= 60</option><option value={75}>Score &gt;= 75</option></select>
      <div className="viewToggle" aria-label="Visualização"><button className={view==='list'?'active':''} onClick={()=>setView('list')} title="Lista"><List size={16}/></button><button className={view==='cards'?'active':''} onClick={()=>setView('cards')} title="Cards"><LayoutGrid size={16}/></button></div>
      <details className="filterDetails"><summary>Filtros de status {activeStatuses.length ? `(${activeStatuses.length})` : ''}</summary><div className="statusBar">{statuses.map(([s,l])=><label className="pill" key={s}><input type="checkbox" checked={activeStatuses.includes(s)} onChange={()=>toggleStatus(s)}/>{l}</label>)}<Button onClick={clearStatuses}>Limpar</Button></div></details>
    </section>
    {loading?<div className="empty glass"><Loader2/> Carregando...</div>:view==='list'?<OpportunityTable items={filtered} busy={busy} onAction={action}/>:<section className="grid">{filtered.map(item=><Card key={item.source_project_id} item={item} busy={busy} onAction={action}/>)}</section>}
    {!loading&&!filtered.length&&<div className="empty glass">Nenhuma oportunidade com esses filtros.</div>}
    <OracleChat projects={chatProjects}/>
    {toast&&<div className="toast" onAnimationEnd={()=>setToast('')}>{toast}</div>}
  </main>
}
function fmtDate(value?: string){ if(!value) return 'Nunca'; const d=new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) }
function StatusStrip({status}:{status:any}){ const s=status?.import_state||{}; return <section className="statusStrip glass"><span><b>Última busca Gmail</b>{fmtDate(s.last_import_at)} · {s.last_import_ok===false?'falhou':`${s.last_saved ?? 0} novos / ${s.last_found ?? 0} encontrados`}</span><span><b>Último pipeline</b>{fmtDate(s.last_pipeline_at)} · {s.last_pipeline_ok===false?'falhou':'ok'}</span>{s.last_query&&<span><b>Filtro</b>{s.last_query}</span>}</section> }
function OpportunityTable({items,busy,onAction}:{items:Opportunity[];busy:string;onAction:(item:Opportunity,status:string,reason:string,outcome?:string)=>void}){
  return <section className="listView glass"><div className="tableHead"><span>Score</span><span>Oportunidade</span><span>Status</span><span>Valor</span><span>Esforço</span><span>Concorrência</span><span>Ações</span></div>{items.map(item=><TableRow key={item.source_project_id} item={item} busy={busy} onAction={onAction}/>)}</section>
}
function TableRow({item,busy,onAction}:{item:Opportunity;busy:string;onAction:(item:Opportunity,status:string,reason:string,outcome?:string)=>void}){
  const ds=item.decision_support||{}; const pd=item.page_details||{}; const status=item.effective_status||ds.status_manual||'review'; const price=ds.price_suggested_effective??ds.price_suggested
  async function copyProposal(){await navigator.clipboard.writeText(ds.proposal_draft||'')}
  return <article className="tableRow">
    <div className="score compact">{item.analysis?.final_score||0}</div>
    <div className="opportunityCell"><div className="eyebrow">#{item.source_project_id} · {pd.subcategory||item.category||'99Freelas'}</div><h2 className="rowTitle">{item.title}</h2><p>{(item.full_description||item.description_preview||'').slice(0,150)}{(item.full_description||'').length>150?'...':''}</p></div>
    <div><span className={`chip ${statusKind(status)}`}>{item.effective_status_label||status}</span></div>
    <div className="valueCell"><b>{brl(price)}</b><span>{brl(ds.pricing_calc?.net_target_suggested)} líquido</span></div>
    <div className="mutedCell"><b>{ds.effort_estimate||'-'}</b><span>{ds.delivery_estimate||'-'}</span></div>
    <div className="mutedCell"><b>{pd.proposals??'-'} propostas</b><span>{pd.interested??'-'} interessados</span></div>
    <div className="rowActions"><Button variant="primary" disabled={busy.includes(item.source_project_id)} onClick={()=>onAction(item,'proposal_sent','Abel enviou proposta ao cliente')}><Send size={15}/> Enviada</Button><Button onClick={copyProposal} title="Copiar proposta"><Copy size={15}/></Button>{item.project_url&&<a className="btn secondary iconBtn" target="_blank" href={item.project_url} title="Abrir projeto"><ExternalLink size={15}/></a>}<details className="moreActions"><summary>Mais</summary><div><Button onClick={()=>onAction(item,'review','Abel enviou perguntas ao cliente; aguardando respostas')}><Check size={15}/> Perguntas</Button><Button onClick={()=>onAction(item,'liked','Abel gostou da oportunidade')}><Heart size={15}/> Gostei</Button><Button variant="danger" onClick={()=>onAction(item,'discarded','Abel descartou a oportunidade')}><ThumbsDown size={15}/> Descartar</Button><Button variant="danger" onClick={()=>onAction(item,'lost','Projeto perdido/cancelado','lost')}><XCircle size={15}/> Perdido</Button></div></details></div>
  </article>
}
function Card({item,busy,onAction}:{item:Opportunity;busy:string;onAction:(item:Opportunity,status:string,reason:string,outcome?:string)=>void}){
  const ds=item.decision_support||{}; const pd=item.page_details||{}; const status=item.effective_status||ds.status_manual||'review'; const price=ds.price_suggested_effective??ds.price_suggested; const calc=ds.pricing_calc||{}
  async function copyProposal(){await navigator.clipboard.writeText(ds.proposal_draft||'');}
  return <article className="card glass"><div className="cardHeader"><div><div className="eyebrow">#{item.source_project_id} · {pd.subcategory||item.category||'99Freelas'}</div><h2 className="title">{item.title}</h2></div><div className="score">{item.analysis?.final_score||0}</div></div><p className="summary">{(item.full_description||item.description_preview||'').slice(0,240)}{(item.full_description||'').length>240?'…':''}</p><div className="chips"><span className={`chip ${statusKind(status)}`}>{item.effective_status_label||status}</span>{ds.ai_pricing?.used&&<span className="chip ok">Precificado por IA</span>}<span className="chip">{pd.proposals??'—'} propostas</span><span className="chip">{pd.interested??'—'} interessados</span>{pd.is_exclusive&&<span className="chip warn">Exclusivo até {dt(pd.exclusive_until_estimated)}</span>}</div><div className="decision"><div className="box"><span>Preço sugerido</span><b>{brl(price)}</b></div><div className="box"><span>Líquido alvo</span><b>{brl(calc.net_target_suggested)}</b></div><div className="box"><span>Esforço</span><b>{ds.effort_estimate||'—'}</b></div><div className="box"><span>Prazo</span><b>{ds.delivery_estimate||'—'}</b></div></div>{item.abel_feedback?.reason&&<p className="summary"><b>Feedback Abel:</b> {item.abel_feedback.reason}</p>}<details className="details"><summary>Análise, perguntas e proposta</summary><p className="summary"><b>Precificação:</b> {ds.pricing_note}</p>{ds.ai_pricing?.used&&<p className="summary"><b>Leitura da IA:</b> {ds.ai_pricing.proposal_summary || 'Estimativa revisada por IA.'}</p>}{ds.ai_pricing?.risks?.length>0&&<div className="box"><span>Riscos considerados pela IA</span><ul>{ds.ai_pricing.risks.map((r:string)=><li key={r}>{r}</li>)}</ul></div>}<div className="box"><span>Perguntas ao cliente</span><ol>{(ds.questions_to_client||[]).map((q:string)=><li key={q}>{q}</li>)}</ol></div><pre className="proposal">{ds.proposal_draft}</pre></details><div className="actions"><Button variant="primary" disabled={busy.includes(item.source_project_id)} onClick={()=>onAction(item,'proposal_sent','Abel enviou proposta ao cliente')}><Send size={15}/> Proposta enviada</Button><Button onClick={()=>onAction(item,'review','Abel enviou perguntas ao cliente; aguardando respostas')}><Check size={15}/> Perguntas enviadas</Button><Button onClick={()=>onAction(item,'liked','Abel gostou da oportunidade')}><Heart size={15}/> Gostei</Button><Button variant="danger" onClick={()=>onAction(item,'discarded','Abel descartou a oportunidade')}><ThumbsDown size={15}/> Descartar</Button><Button variant="danger" onClick={()=>onAction(item,'lost','Projeto perdido/cancelado','lost')}><XCircle size={15}/> Perdido</Button><Button onClick={copyProposal}><Copy size={15}/> Copiar</Button>{item.project_url&&<a className="btn secondary" target="_blank" href={item.project_url}><ExternalLink size={15}/> Abrir</a>}</div></article>
}
