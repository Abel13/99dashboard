'use client'

import { ReactNode, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, Sparkles, Target, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { topTerms } from './helpers'
import { Panel } from './ui'
import type { Opportunity } from './types'

export function Profile({ items }: { items: Opportunity[] }) {
  const terms = topTerms(items, 18)
  const [skills, setSkills] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [username, setUsername] = useState('abeldutraui')
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)

  async function loadSkills() {
    setLoading(true)
    const response = await fetch('/api/skill-suggestions', { cache: 'no-store' })
    const data = await response.json()
    setSkills(data)
    setLoading(false)
  }

  async function loadProfile(refresh = false) {
    setProfileLoading(true)
    const response = await fetch(`/api/profile?username=${encodeURIComponent(username)}${refresh ? '&refresh=1' : ''}`, { cache: 'no-store' })
    const data = await response.json()
    if (data.profile) {
      setProfile(data.profile)
      setUsername(data.profile.username)
    }
    setProfileLoading(false)
  }

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (data.settings?.profile_username) setUsername(data.settings.profile_username)
      })
      .finally(() => setTimeout(() => loadProfile(false), 0))
    loadSkills()
  }, [])

  const inventory = profile?.skills?.length ? profile.skills : terms.map(([term]) => term)
  const demand = skills?.demand_terms || terms.map(([skill, demand]) => ({ skill, demand }))
  const matchedDemand = demand.filter((item: any) => includesTerm(inventory, item.skill)).slice(0, 8)
  const missingDemand = demand.filter((item: any) => !includesTerm(inventory, item.skill)).slice(0, 8)
  const diagnostics = profileDiagnostics(profile, inventory, demand)
  const strength = diagnostics.length ? Math.round((diagnostics.filter((item) => item.ok).length / diagnostics.length) * 100) : 0
  const prioritySuggestions = (skills?.suggestions || []).slice().sort((a: any, b: any) => priorityWeight(b.priority) - priorityWeight(a.priority)).slice(0, 5)

  return (
    <>
      <section className="profileHero glass">
        <div>
          <span className="kicker">Como o 99Freelas te vê</span>
          <h2>{profile?.name || 'Perfil público 99Freelas'}</h2>
          <p>{profile?.headline || 'Importe o perfil para analisar posicionamento, prova social e aderência com as oportunidades atuais.'}</p>
          <div className="profileLookup">
            <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="abeldutraui" aria-label="Usuário 99Freelas" />
            <Button onClick={() => loadProfile(true)} disabled={profileLoading}>
              {profileLoading ? <Loader2 className="loadingIcon" size={15} /> : <RefreshCw size={15} />}
              Importar perfil
            </Button>
            {profile?.url && (
              <a className="btn secondary" target="_blank" href={profile.url}>
                <ExternalLink size={15} />
                Abrir no 99Freelas
              </a>
            )}
          </div>
        </div>
        <div className="profileScore">
          <b>{profile ? strength : '—'}</b>
          <span>força do perfil</span>
        </div>
      </section>

      <section className="profileSignalGrid">
        <SignalCard label="Nota" value={profile?.rating ?? '—'} detail={`${profile?.reviews ?? 0} avaliações`} />
        <SignalCard label="Projetos" value={profile?.completed_projects ?? '—'} detail="concluídos" />
        <SignalCard label="Ranking" value={profile?.ranking ?? '—'} detail={profile?.registered_since ? `desde ${profile.registered_since}` : 'sinal público'} />
        <SignalCard label="Habilidades" value={inventory.length || '—'} detail={`${matchedDemand.length} aderentes à demanda`} />
      </section>

      <section className="profileWorkGrid">
        <Panel title="Diagnóstico acionável">
          <ul className="profileChecklist">
            {diagnostics.map((item) => (
              <li key={item.label} className={item.ok ? 'ok' : 'warn'}>
                {item.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <div>
                  <b>{item.label}</b>
                  <span>{item.detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Melhorias prioritárias">
          <div className="panelHeadInline">
            <p className="summary">Ações para melhorar posicionamento com base nas oportunidades importadas.</p>
            <Button onClick={loadSkills} disabled={loading}>
              {loading ? <Loader2 className="loadingIcon" size={15} /> : <Sparkles size={15} />}
              Atualizar
            </Button>
          </div>
          {skills?.source && <span className={`chip ${skills.source === 'ai' ? 'ok' : 'warn'}`}>{skills.source === 'ai' ? 'IA interna' : 'fallback local'}</span>}
          <ul className="profileActionList">
            {prioritySuggestions.length ? prioritySuggestions.map((item: any) => (
              <li key={item.name}>
                <span className={`chip ${item.priority === 'alta' ? 'ok' : item.priority === 'baixa' ? '' : 'warn'}`}>{item.priority}</span>
                <div>
                  <b>{item.name}</b>
                  <p>{item.reason}</p>
                  <small>{item.action}</small>
                </div>
              </li>
            )) : <li><span className="chip warn">pendente</span><div><b>Atualize as sugestões</b><p>Sem recomendações carregadas ainda.</p></div></li>}
          </ul>
        </Panel>

        <Panel title="Aderência com oportunidades">
          <div className="profileDemandSplit">
            <DemandColumn icon={<CheckCircle2 size={16} />} title="Já comunica" items={matchedDemand} empty="Pouca aderência detectada entre perfil e demanda." />
            <DemandColumn icon={<Target size={16} />} title="Oportunidades para posicionar" items={missingDemand} empty="Nenhuma lacuna forte detectada." />
          </div>
        </Panel>

        <Panel title="Inventário público">
          <SectionLabel icon={<TrendingUp size={15} />} label="Habilidades" />
          <div className="chips compactChips">{inventory.map((term: string) => <span className="chip" key={term}>{term}</span>)}</div>
          <SectionLabel icon={<Target size={15} />} label="Áreas de interesse" />
          <div className="chips compactChips">{(profile?.interests || []).length ? profile.interests.map((term: string) => <span className="chip" key={term}>{term}</span>) : <span className="summary">Nenhuma área importada.</span>}</div>
        </Panel>
      </section>

      <details className="profileTextPanel glass">
        <summary>Texto público importado</summary>
        <div>
          <h3>Sobre mim</h3>
          <p className="summary">{profile?.about || 'Importe o perfil para visualizar o texto público.'}</p>
          {profile?.experience && (
            <>
              <h3>Experiência profissional</h3>
              <p className="summary">{profile.experience}</p>
            </>
          )}
        </div>
      </details>
    </>
  )
}

function SignalCard({ label, value, detail }: { label: string; value: any; detail: string }) {
  return (
    <div className="profileSignal glass">
      <span>{label}</span>
      <b>{value}</b>
      <small>{detail}</small>
    </div>
  )
}

function SectionLabel({ icon, label }: { icon: ReactNode; label: string }) {
  return <span className="sectionSource app">{icon}{label}</span>
}

function DemandColumn({ icon, title, items, empty }: { icon: ReactNode; title: string; items: any[]; empty: string }) {
  return (
    <div>
      <h4>{icon}{title}</h4>
      {items.length ? (
        <div className="chips compactChips">
          {items.map((item: any) => <span className="chip" key={item.skill}>{item.skill} · {item.demand}</span>)}
        </div>
      ) : <p className="summary">{empty}</p>}
    </div>
  )
}

function includesTerm(items: string[], term = '') {
  const normalized = normalize(term)
  return items.some((item) => normalize(item).includes(normalized) || normalized.includes(normalize(item)))
}

function normalize(value = '') {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function priorityWeight(priority = '') {
  if (priority === 'alta') return 3
  if (priority === 'média') return 2
  return 1
}

function profileDiagnostics(profile: any, inventory: string[], demand: any[]) {
  const aboutLength = (profile?.about || '').length
  const hasDemandMatch = demand.some((item: any) => includesTerm(inventory, item.skill))
  return [
    {
      label: 'Headline clara',
      ok: Boolean(profile?.headline && profile.headline.length > 20),
      detail: profile?.headline ? 'A chamada aparece no topo do perfil público.' : 'Inclua uma frase objetiva sobre o tipo de projeto que você entrega.',
    },
    {
      label: 'Prova social',
      ok: Number(profile?.reviews || 0) >= 3 || Number(profile?.completed_projects || 0) >= 3,
      detail: `${profile?.reviews ?? 0} avaliações e ${profile?.completed_projects ?? 0} projetos concluídos importados.`,
    },
    {
      label: 'Sobre mim com contexto',
      ok: aboutLength >= 260,
      detail: aboutLength ? `${aboutLength} caracteres. Mostre nichos, entregáveis, processo e diferenciais.` : 'Texto não importado ou ausente no perfil público.',
    },
    {
      label: 'Habilidades suficientes',
      ok: inventory.length >= 8,
      detail: `${inventory.length} habilidades detectadas. Priorize termos buscados em projetos bons.`,
    },
    {
      label: 'Aderência à demanda atual',
      ok: hasDemandMatch,
      detail: hasDemandMatch ? 'Há interseção entre perfil e oportunidades importadas.' : 'Adicione termos recorrentes das oportunidades ao perfil, se forem reais.',
    },
  ]
}
