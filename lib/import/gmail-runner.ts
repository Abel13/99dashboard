import { parseGmailRawDebug } from '@/lib/import/gmail-parser'
import { enrichProjectAndClient } from '@/lib/import/project-enricher'
import { enrichOpportunity } from '@/lib/pricing'
import { getAppSettings, type AppSettings } from '@/lib/settings'
import { updateImportState, upsertOpportunity } from '@/lib/softwarehouse'

const DEFAULT_GMAIL_QUERY = '(from:99freelas.com.br OR from:abel.o.d@outlook.com) newer_than:7d (99freelas OR 99Freelas)'

async function accessToken(settings: AppSettings) {
  const client_id = settings.gmail_client_id
  const client_secret = settings.gmail_client_secret
  const refresh_token = settings.gmail_refresh_token
  if (!client_id || !client_secret || !refresh_token) throw new Error('Gmail OAuth env ausente: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET e GMAIL_REFRESH_TOKEN')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: 'refresh_token' }),
  })
  if (!res.ok) throw new Error(`Falha ao renovar token Gmail: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.access_token as string
}

async function gmailFetch(token: string, url: string) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function runGmailImport(options: { trigger?: 'manual' | 'auto' | 'scheduler'; settings?: AppSettings } = {}) {
  const settings = options.settings || await getAppSettings()
  const query = settings.gmail_query || DEFAULT_GMAIL_QUERY
  const trigger = options.trigger || 'manual'

  try {
    const token = await accessToken(settings)
    const list = await gmailFetch(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=25`)
    const messages = list.messages || []
    let parsed = 0, saved = 0, inserted = 0, updated = 0, duplicateInRun = 0
    const seenProjectIds = new Set<string>()
    const errors: any[] = []
    const trace: any[] = []

    for (const msg of messages) {
      try {
        const raw = await gmailFetch(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=raw`)
        const parsedEmail = await parseGmailRawDebug(raw.raw)
        const looksLike99Freelas = /99freelas/i.test(`${parsedEmail.meta.subject || ''} ${parsedEmail.meta.from || ''} ${parsedEmail.meta.to || ''}`) || Boolean(parsedEmail.meta.has_project_url)
        if (!looksLike99Freelas) {
          trace.push({ id: msg.id, ...parsedEmail.meta, skipped_reason: 'Filtro interno: não parece e-mail/projeto 99Freelas' })
          continue
        }
        trace.push({ id: msg.id, ...parsedEmail.meta })
        const opportunity = parsedEmail.opportunity
        if (!opportunity) continue
        parsed++
        const duplicate = seenProjectIds.has(String(opportunity.source_project_id))
        seenProjectIds.add(String(opportunity.source_project_id))
        const pageEnriched = await enrichProjectAndClient(opportunity)
        const enriched = await enrichOpportunity(pageEnriched)
        const result = await upsertOpportunity(enriched)
        if (duplicate) duplicateInRun++
        if (result.inserted) inserted++
        if (result.updated) updated++
        saved++
      } catch (err: any) {
        errors.push({ id: msg.id, error: err.message || String(err) })
        trace.push({ id: msg.id, error: err.message || String(err) })
      }
    }

    const state = await updateImportState({
      last_import_at: new Date().toISOString(),
      last_import_trigger: trigger,
      last_query: query,
      last_found: messages.length,
      last_parsed: parsed,
      last_saved: saved,
      last_inserted: inserted,
      last_updated: updated,
      last_duplicate_in_run: duplicateInRun,
      last_unique_projects: seenProjectIds.size,
      last_message_trace: trace.slice(0, 25),
      last_errors: errors,
      last_import_ok: errors.length === 0,
      last_import_error: errors[0]?.error || null,
    })

    return { ok: true, trigger, query, found: messages.length, parsed, saved, inserted, updated, duplicateInRun, uniqueProjects: seenProjectIds.size, trace, errors, state }
  } catch (err: any) {
    await updateImportState({
      last_import_at: new Date().toISOString(),
      last_import_trigger: trigger,
      last_query: query,
      last_import_ok: false,
      last_import_error: err.message || String(err),
    })
    throw err
  }
}
