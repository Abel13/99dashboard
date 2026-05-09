import { simpleParser } from 'mailparser'
import { htmlToText } from 'html-to-text'
import type { Opportunity } from '@/lib/domain'

const URL_RE = /https:\/\/www\.99freelas\.com\.br\/project\/[^>\s)"']+/i
const PROJECT_BLOCK_RE = /interesse:\s*([\s\S]*?)\s*<(https:\/\/www\.99freelas\.com\.br\/project\/[^>]+)>\s*([\s\S]*?)\s*\|\s*([\s\S]*?)\s*\|\s*Orçamento:\s*([^\n\r]+?)\s+([\s\S]*?)\s+Leia mais\./i

export function projectIdFromUrl(url: string) {
  return url.match(/-(\d+)(?:\?|$|[#/])/i)?.[1] || url.match(/(\d{5,})/)?.[1] || ''
}
function clean(text: string) { return (text || '').replace(/\s+/g, ' ').trim() }

export async function parseGmailRaw(raw: string): Promise<Opportunity | null> {
  const buf = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  const parsed = await simpleParser(buf)
  const html = parsed.html || ''
  const text = clean(parsed.text || (html ? htmlToText(html, { wordwrap: false }) : ''))
  const block = text.match(PROJECT_BLOCK_RE)
  const url = block?.[2] || text.match(URL_RE)?.[0]
  if (!url) return null
  const title = clean(block?.[1] || String(parsed.subject || '').replace(/^.*interesse:\s*/i, ''))
  const description = clean(block?.[6] || text)
  const id = projectIdFromUrl(url)
  if (!id || !title) return null
  return {
    source: 'gmail_api',
    source_project_id: id,
    title,
    project_url: url,
    category: clean(block?.[3] || ''),
    level: clean(block?.[4] || ''),
    budget: clean(block?.[5] || ''),
    description_preview: description.slice(0, 260),
    full_description: description,
    received_at_raw: parsed.date?.toISOString() || '',
    email_subject: String(parsed.subject || ''),
    email_from: (parsed.from as any)?.text || '',
    email_to: Array.isArray(parsed.to) ? parsed.to.map((x:any)=>x.text).join(', ') : ((parsed.to as any)?.text || ''),
  }
}
