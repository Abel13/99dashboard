import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { paths } from '@/lib/paths'
import { runPipeline, updateImportState } from '@/lib/softwarehouse'

function authorized(req: NextRequest){
  const secret = process.env.AUTO_IMPORT_CRON_SECRET || process.env.DASHBOARD_API_TOKEN
  return !secret || secret === 'change-me' || req.headers.get('authorization') === `Bearer ${secret}` || req.nextUrl.searchParams.get('token') === secret
}
function b64urlToText(value: string){ return Buffer.from(value.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8') }
async function accessToken(){
  const client_id = process.env.GMAIL_CLIENT_ID
  const client_secret = process.env.GMAIL_CLIENT_SECRET
  const refresh_token = process.env.GMAIL_REFRESH_TOKEN
  if(!client_id || !client_secret || !refresh_token) throw new Error('Gmail OAuth env ausente: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET e GMAIL_REFRESH_TOKEN')
  const res = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({ client_id, client_secret, refresh_token, grant_type:'refresh_token' }) })
  if(!res.ok) throw new Error(`Falha ao renovar token Gmail: ${res.status}`)
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
  try{
    const token = await accessToken()
    const query = process.env.GMAIL_LABEL_OR_QUERY || 'from:(99freelas.com.br) newer_than:7d'
    const list = await gmailFetch(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=25`)
    const messages = list.messages || []
    await fs.mkdir(paths.emlDir, { recursive:true })
    const saved:string[] = []
    for(const msg of messages){
      const out = path.join(paths.emlDir, `gmail-${msg.id}.eml`)
      try{ await fs.access(out); continue }catch{}
      const raw = await gmailFetch(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=raw`)
      await fs.writeFile(out, b64urlToText(raw.raw), 'utf8')
      saved.push(out)
    }
    const pipeline = saved.length ? await runPipeline() : undefined
    const state = await updateImportState({
      last_import_at: new Date().toISOString(),
      last_query: query,
      last_found: messages.length,
      last_saved: saved.length,
      last_files: saved,
      last_import_ok: true,
      last_import_error: null,
    })
    return NextResponse.json({ ok:true, query, found:messages.length, saved:saved.length, files:saved, pipeline, state })
  }catch(err:any){
    await updateImportState({ last_import_at: new Date().toISOString(), last_import_ok: false, last_import_error: err.message || String(err) })
    return NextResponse.json({ ok:false, error:err.message || String(err) }, { status:500 })
  }
}
export async function GET(req: NextRequest){ return POST(req) }
