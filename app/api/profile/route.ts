import { NextRequest, NextResponse } from 'next/server'
import { getAppSettings, saveAppSettings } from '@/lib/settings'
import { readImportState, updateImportState } from '@/lib/softwarehouse'

function decodeHtml(input = '') {
  return input
    .replace(/&ccedil;/g, 'ç').replace(/&atilde;/g, 'ã').replace(/&otilde;/g, 'õ')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú')
    .replace(/&acirc;/g, 'â').replace(/&ecirc;/g, 'ê').replace(/&ocirc;/g, 'ô')
    .replace(/&agrave;/g, 'à').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
function between(text: string, start: string, end: string) {
  const a = text.indexOf(start); if (a < 0) return ''
  const b = text.indexOf(end, a + start.length); if (b < 0) return text.slice(a + start.length)
  return text.slice(a + start.length, b)
}
function listAfter(text: string, heading: string, nextHeading: string) {
  const section = between(text, heading, nextHeading)
  return decodeHtml(section).split(/\s+-\s+|\n-\s+/).map(x => x.trim()).filter(Boolean).slice(0, 30)
}
function parseProfile(html: string, username: string) {
  const title = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '')
  const md = html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/li>/gi, '\n- ')
  const name = decodeHtml(md.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || title.split('|')[0] || username)
  const headline = decodeHtml(title.split('|')[1] || '')
  const ratingMatch = decodeHtml(md).match(/\((\d+(?:[,.]\d+)?)\s*-\s*(\d+)\s*avaliações\)/i)
  const ranking = decodeHtml(md).match(/Ranking:\s*([0-9.]+)/i)?.[1] || ''
  const completed = decodeHtml(md).match(/Projetos concluídos:\s*(\d+)/i)?.[1] || ''
  const recommendations = decodeHtml(md).match(/Recomendações:\s*(\d+)/i)?.[1] || ''
  const registered_since = decodeHtml(md).match(/Registrado desde:\s*([0-9/]+)/i)?.[1] || ''
  const about = decodeHtml(between(md, 'Sobre mim:', 'Resumo da experiência profissional:'))
  const experience = decodeHtml(between(md, 'Resumo da experiência profissional:', 'Habilidades:'))
  const skills = listAfter(md, 'Habilidades:', 'Áreas de interesse:').map(x => x.replace(/^Habilidades:\s*/i, '')).filter(x => x && !x.includes('Áreas de interesse'))
  const interests = listAfter(md, 'Áreas de interesse:', '@2014-2026').map(x => x.replace(/^Áreas de interesse:\s*/i, '')).filter(Boolean)
  return {
    username,
    url: `https://www.99freelas.com.br/user/${username}`,
    imported_at: new Date().toISOString(),
    name,
    headline,
    rating: ratingMatch ? Number(ratingMatch[1].replace(',', '.')) : null,
    reviews: ratingMatch ? Number(ratingMatch[2]) : null,
    ranking: ranking || null,
    completed_projects: completed ? Number(completed) : null,
    recommendations: recommendations ? Number(recommendations) : null,
    registered_since: registered_since || null,
    about,
    experience,
    skills,
    interests,
  }
}

export async function GET(req: NextRequest) {
  const settings = await getAppSettings()
  const username = req.nextUrl.searchParams.get('username') || settings.profile_username || 'abeldutraui'
  const state = await readImportState()
  const cached = state.profile_data
  if (cached?.username === username && !req.nextUrl.searchParams.get('refresh')) return NextResponse.json({ ok: true, profile: cached, cached: true })
  const res = await fetch(`https://www.99freelas.com.br/user/${encodeURIComponent(username)}`, { headers: { 'user-agent': 'Mozilla/5.0 99dashboard profile importer' } })
  if (!res.ok) return NextResponse.json({ ok: false, error: `99Freelas ${res.status}` }, { status: 502 })
  const html = await res.text()
  const profile = parseProfile(html, username)
  await updateImportState({ profile_data: profile, profile_imported_at: profile.imported_at })
  if (settings.profile_username !== username) await saveAppSettings({ profile_username: username })
  return NextResponse.json({ ok: true, profile, cached: false })
}
