'use client'
import { FormEvent, useMemo, useState } from 'react'
import { Bot, Loader2, MessageCircle, Send, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { Button } from './ui/button'

type Message = { role: 'user' | 'assistant'; content: string }
type ProjectOption = { id: string; title: string }

export function OracleChat({ projects }: { projects: ProjectOption[] }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Oi, Abel. Me diga qual projeto você quer olhar — posso revisar preço, riscos, perguntas ou proposta.' },
  ])
  const [input, setInput] = useState('')
  const [projectId, setProjectId] = useState('')
  const [loading, setLoading] = useState(false)
  const selectedLabel = useMemo(() => projects.find(p => p.id === projectId)?.title, [projects, projectId])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next, projectId }),
      })
      const data = await res.json()
      setMessages([...next, { role: 'assistant', content: res.ok ? data.message : `Não consegui consultar a IA: ${data.error || 'erro desconhecido'}` }])
    } catch (err: any) {
      setMessages([...next, { role: 'assistant', content: `Não consegui consultar a IA: ${err.message || String(err)}` }])
    } finally {
      setLoading(false)
    }
  }

  if (!open) return <button className="chatFab" onClick={() => setOpen(true)}><MessageCircle size={18}/> Falar com Oracle</button>

  return <aside className="chatPanel glass">
    <header className="chatHead">
      <div><span className="kicker"><Bot size={14}/> Oracle IA</span><p>{selectedLabel ? `Contexto: #${projectId} · ${selectedLabel}` : 'Contexto: todos os projetos'}</p></div>
      <button className="chatClose" onClick={() => setOpen(false)}><X size={18}/></button>
    </header>
    <select className="select" value={projectId} onChange={e => setProjectId(e.target.value)}>
      <option value="">Todos os projetos</option>
      {projects.map(p => <option key={p.id} value={p.id}>#{p.id} · {p.title}</option>)}
    </select>
    <div className="chatMessages">
      {messages.map((m, i) => <div key={i} className={`chatBubble ${m.role}`}><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{m.content}</ReactMarkdown></div>)}
      {loading && <div className="chatBubble assistant"><Loader2 className="loadingIcon" size={14}/> Lendo os sinais…</div>}
    </div>
    <form className="chatForm" onSubmit={submit}>
      <input className="input" value={input} onChange={e => setInput(e.target.value)} placeholder="Pergunte sobre preço, risco, proposta…" />
      <Button variant="primary" disabled={loading || !input.trim()}>
        {loading ? <Loader2 className="loadingIcon" size={15}/> : <Send size={15}/>}
      </Button>
    </form>
  </aside>
}
