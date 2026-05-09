'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { topTerms } from './helpers'
import { Complexity, Metric, Panel } from './ui'
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

  return (
    <section className="dashboardGrid">
      <Panel title="Perfil 99Freelas">
        <label className="fieldLabel">
          Usuário 99Freelas
          <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="abeldutraui" />
        </label>
        <div className="actions">
          <Button onClick={() => loadProfile(true)} disabled={profileLoading}>
            {profileLoading ? <Loader2 size={15} /> : <RefreshCw size={15} />}
            Importar perfil
          </Button>
          {profile?.url && (
            <a className="btn secondary" target="_blank" href={profile.url}>
              <ExternalLink size={15} />
              Abrir perfil
            </a>
          )}
        </div>
        {profile && (
          <div className="profileBox">
            <h3>{profile.name}</h3>
            <p>{profile.headline}</p>
            <div className="chips">
              <span className="chip">Nota {profile.rating ?? '—'}</span>
              <span className="chip">{profile.reviews ?? 0} avaliações</span>
              <span className="chip">Ranking {profile.ranking ?? '—'}</span>
              <span className="chip">{profile.completed_projects ?? 0} projetos concluídos</span>
              <span className="chip">Desde {profile.registered_since ?? '—'}</span>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Resumo importado">
        <p className="summary">{profile?.about || 'Clique em Importar perfil para buscar os dados públicos do 99Freelas.'}</p>
        {profile?.experience && (
          <details className="details">
            <summary>Experiência profissional</summary>
            <p className="summary">{profile.experience}</p>
          </details>
        )}
      </Panel>

      <Panel title="Precificação">
        <Metric label="Preço por hora" value="R$ 130/h" />
        <Metric label="Taxa da plataforma" value="20%" />
        <Metric label="Gross-up" value="÷ 0,80" />
      </Panel>

      <Panel title="Eficiência do perfil">
        <Complexity value={Math.min(100, 45 + (profile?.skills?.length || 0) * 4 + (profile?.completed_projects || 0) * 5)} label="Calculada com perfil + matches" />
        <p className="summary">Considera inventário importado, aderência às demandas e sinais públicos do perfil.</p>
      </Panel>

      <Panel title="Inventário de habilidades importado">
        <div className="chips">{inventory.map((term: string) => <span className="chip" key={term}>{term}</span>)}</div>
      </Panel>

      <Panel title="Áreas de interesse">
        <div className="chips">{(profile?.interests || []).map((term: string) => <span className="chip" key={term}>{term}</span>)}</div>
      </Panel>

      <Panel title="Sugestão dinâmica de novas habilidades">
        <div className="panelHeadInline">
          <p className="summary">Gerada pela IA interna a partir das oportunidades, perfil importado e padrões de demanda.</p>
          <Button onClick={loadSkills} disabled={loading}>
            {loading ? <Loader2 size={15} /> : <Sparkles size={15} />}
            Atualizar
          </Button>
        </div>
        {skills?.source && <span className={`chip ${skills.source === 'ai' ? 'ok' : 'warn'}`}>{skills.source === 'ai' ? 'IA interna' : 'fallback local'}</span>}
        <ul className="skillSuggestList">
          {(skills?.suggestions || []).map((item: any) => (
            <li key={item.name}>
              <div>
                <b>{item.name}</b>
                <span className={`chip ${item.priority === 'alta' ? 'ok' : item.priority === 'baixa' ? '' : 'warn'}`}>{item.priority}</span>
              </div>
              <p>{item.reason}</p>
              <small>{item.action}</small>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Sinais de demanda aprendidos">
        <div className="chips">
          {(skills?.demand_terms || terms.map(([skill, demand]) => ({ skill, demand }))).slice(0, 18).map((item: any) => (
            <span className="chip" key={item.skill}>{item.skill} · {item.demand}</span>
          ))}
        </div>
      </Panel>
    </section>
  )
}
