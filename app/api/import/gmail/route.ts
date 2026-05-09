import { NextRequest, NextResponse } from 'next/server'
import { parseGmailRaw } from '@/lib/import/gmail-parser'
import { enrichOpportunity } from '@/lib/pricing'
import { updateImportState, upsertOpportunity } from '@/lib/softwarehouse'

function authorized(req: NextRequest){
  const secret = process.env.AUTO_IMPORT_CRON_SECRET || process.env.DASHBOARD_API_TOKEN
  return !secret || secret === 'change-me' || req.headers.get('authorization') === `Bearer ${secret}` || req.nextUrl.searchParams.get('token') === secret
}
async function accessToken(){
  const client_id = process.env.GMAIL_CLIENT_ID
  const client_secret = process.env.GMAIL_CLIENT_SECRET
  const refresh_token = process.env.GMAIL_REFRESH_TOKEN
  if(!client_id || !client_secret || !refresh_token) throw new Error('Gmail OAuth env ausente: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET e GMAIL_REFRESH_TOKEN')
  const res = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({ client_id, client_secret, refresh_token, grant_type:'refresh_token' }) })
  if(!res.ok) throw new Error(`Falha ao renovar token Gmail: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.access_token as string
}
async function gmailFetch(token:string, url:string){
  const res = await fetch(url, { headers:{ authorization:`Bearer ${token}` } })
  if(!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`)
  return res.json()
}
export async function POST(req: NextRequest){
  if(!authorized(req)) return NextResponse.json({error:'unauthorized'},{status:401})
  const query = process.env.GMAIL_LABEL_OR_QUERY || 'from:(99freelas.com.br) newer_than:7d'
  try{
    const token = await accessToken()
    const list = await gmailFetch(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=25`)
    const messages = list.messages || []
    let parsed = 0, saved = 0
    const errors: any[] = []
    for(const msg of messages){
      try {
        const raw = await gmailFetch(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=raw`)
        const opportunity = await parseGmailRaw(raw.raw)
        if (!opportunity) continue
        parsed++
        const enriched = await enrichOpportunity(opportunity)
        await upsertOpportunity(enriched)
        saved++
      } catch (err:any) { errors.push({ id: msg.id, error: err.message || String(err) }) }
    }
    const state = await updateImportState({ last_import_at: new Date().toISOString(), last_query: query, last_found: messages.length, last_parsed: parsed, last_saved: saved, last_errors: errors, last_import_ok: errors.length === 0, last_import_error: errors[0]?.error || null })
    return NextResponse.json({ ok:true, query, found:messages.length, parsed, saved, errors, state })
  }catch(err:any){
    await updateImportState({ last_import_at: new Date().toISOString(), last_query: query, last_import_ok: false, last_import_error: err.message || String(err) })
    return NextResponse.json({ ok:false, error:err.message || String(err) }, { status:500 })
  }
}
export async function GET(req: NextRequest){ return POST(req) }
