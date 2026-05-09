import { NextRequest, NextResponse } from 'next/server'
import { getAppSettings } from '@/lib/settings'
import { runGmailImport } from '@/lib/import/gmail-runner'

function authorized(req: NextRequest, secret?: string){
  const localDev = ['localhost','127.0.0.1','::1'].includes(req.nextUrl.hostname)
  return localDev || !secret || secret === 'change-me' || req.headers.get('authorization') === `Bearer ${secret}` || req.nextUrl.searchParams.get('token') === secret
}
export async function POST(req: NextRequest){
  const settings = await getAppSettings()
  if(!authorized(req, settings.dashboard_api_token)) return NextResponse.json({error:'unauthorized'},{status:401})
  try{
    return NextResponse.json(await runGmailImport({ trigger: 'manual', settings }))
  }catch(err:any){
    return NextResponse.json({ ok:false, error:err.message || String(err) }, { status:500 })
  }
}
export async function GET(req: NextRequest){ return POST(req) }
