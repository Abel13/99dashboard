import { htmlToText } from 'html-to-text'
import type { Opportunity } from '@/lib/domain'

function clean(text = '') { return text.replace(/\s+/g, ' ').trim() }
function abs(url = '') { return url.startsWith('http') ? url : `https://www.99freelas.com.br${url}` }
function pickTable(html: string, label: string) {
  const re = new RegExp(`<th>\\s*${label}:?\\s*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, 'i')
  const raw = html.match(re)?.[1] || ''
  return clean(htmlToText(raw, { wordwrap: false }))
}
function first(regex: RegExp, text: string) { return clean(htmlToText(text.match(regex)?.[1] || '', { wordwrap: false })) }
function badTitle(title = '') {
  const t = clean(title)
  return !t || t.length > 180 || /Pesquisar|Freelancers|Projetos\s+Freelancers|Login|Cadastre-se|Descrição do Projeto/i.test(t)
}
function titleFromSlug(url = '') {
  const slug = url.split('/project/')[1]?.split('?')[0]?.replace(/-\d+\/?$/, '') || ''
  return slug.split('-').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
function dateFromMillis(value?: string) { const n = Number(value || 0); return n ? new Date(n).toISOString() : null }
function descriptionFromHtml(html: string) {
  const text = htmlToText(html, { wordwrap: false, selectors: [{ selector: 'a', options: { ignoreHref: true } }] })
  const start = text.search(/Descrição do Projeto:/i)
  if (start < 0) return ''
  let desc = text.slice(start).replace(/^Descrição do Projeto:\s*/i, '')
  const stops = [/Informações Adicionais/i, /Propostas/i, /Cliente/i, /Gerenciamento do projeto/i]
  const indexes = stops.map(r => desc.search(r)).filter(i => i > 300)
  if (indexes.length) desc = desc.slice(0, Math.min(...indexes))
  return clean(desc)
}
async function fetchHtml(url: string) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 99dashboard enricher', accept: 'text/html' } })
  if (!res.ok) throw new Error(`Fetch ${url} falhou: ${res.status}`)
  return res.text()
}
async function enrichClient(clientUrl?: string, clientName?: string, score?: string) {
  if (!clientUrl) return clientName ? { name: clientName, score: score ? Number(score) : null } : null
  try {
    const html = await fetchHtml(abs(clientUrl))
    const text = htmlToText(html, { wordwrap: false })
    return {
      name: first(/#\s*([^\n]+)/, text) || clientName || '',
      url: abs(clientUrl),
      score: score ? Number(score) : null,
      rating: Number(text.match(/\((\d+(?:[,.]\d+)?)\s*-\s*(\d+)\s*avalia/i)?.[1]?.replace(',', '.') || score || 0) || null,
      reviews: Number(text.match(/\((\d+(?:[,.]\d+)?)\s*-\s*(\d+)\s*avalia/i)?.[2] || 0) || null,
      ranking: text.match(/Ranking:\s*([0-9.]+)/i)?.[1] || null,
      completed_projects: Number(text.match(/Projetos concluídos:\s*(\d+)/i)?.[1] || 0) || null,
      recommendations: Number(text.match(/Recomendações:\s*(\d+)/i)?.[1] || 0) || null,
      registered_since: text.match(/Registrado desde:\s*([0-9/]+)/i)?.[1] || null,
      about_preview: clean((text.split(/Sobre mim:/i)[1] || '').split(/Resumo da experiência profissional:/i)[0] || '').slice(0, 800),
      imported_at: new Date().toISOString(),
    }
  } catch (err: any) {
    return { name: clientName || '', url: abs(clientUrl), score: score ? Number(score) : null, error: err.message || String(err) }
  }
}

export async function enrichProjectAndClient(item: Opportunity): Promise<Opportunity> {
  if (!item.project_url) return item
  try {
    const html = await fetchHtml(item.project_url)
    const h1Title = first(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html)
    const metaTitle = first(/<title[^>]*>([\s\S]*?)<\/title>/i, html).split('|')[0]?.trim()
    const title = !badTitle(h1Title) ? h1Title : (!badTitle(metaTitle) ? metaTitle : titleFromSlug(item.project_url))
    const canonicalTitle = badTitle(item.title) ? (title || item.title) : item.title
    const description = descriptionFromHtml(html)
    const clientMatch = html.match(/<a\s+href="(\/user\/[^"]+)"[^>]*>\s*<span class="name">([\s\S]*?)<\/span>/i)
    const clientScore = html.match(/data-score="([0-9.]+)"/i)?.[1]
    const client = await enrichClient(clientMatch?.[1], clean(htmlToText(clientMatch?.[2] || '', { wordwrap: false })), clientScore)
    const page_details = {
      ...(item.page_details || {}),
      enriched_at: new Date().toISOString(),
      title,
      category: pickTable(html, 'Categoria') || item.category,
      budget: pickTable(html, 'Orçamento') || item.budget,
      level: pickTable(html, 'Nível de experiência') || item.level,
      visibility: pickTable(html, 'Visibilidade'),
      proposals: Number(pickTable(html, 'Propostas') || 0) || null,
      interested: Number(pickTable(html, 'Interessados') || 0) || null,
      minimum_value: pickTable(html, 'Valor Mínimo'),
      remaining_until: dateFromMillis(html.match(/class="datetime-restante"\s+cp-datetime="(\d+)"/i)?.[1] || ''),
      source: 'project_page',
    }
    return {
      ...item,
      // Preserve the canonical title imported from Gmail unless a previous enrichment polluted it.
      title: canonicalTitle,
      category: page_details.category || item.category,
      level: page_details.level || item.level,
      budget: page_details.budget || item.budget,
      full_description: description && description.length > (item.full_description || '').length ? description : item.full_description,
      description_preview: (description || item.full_description || item.description_preview || '').slice(0, 260),
      page_details,
      client_details: client,
    }
  } catch (err: any) {
    return { ...item, page_details: { ...(item.page_details || {}), enrichment_error: err.message || String(err), enriched_at: new Date().toISOString() } }
  }
}
