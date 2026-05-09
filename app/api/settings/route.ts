import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_SETTINGS, getAppSettings, redactSettings, saveAppSettings } from '@/lib/settings'
import { ensureGmailImportScheduler } from '@/lib/import/gmail-scheduler'

export async function GET() {
  try {
    const settings = await getAppSettings({ redact: true })
    return NextResponse.json({ ok: true, settings })
  } catch (err: any) {
    // Configurações não podem derrubar a UI. Se Supabase/migration ainda não
    // estiver pronto, a tela abre com fallback e mostra o erro.
    return NextResponse.json({
      ok: false,
      settings: redactSettings(DEFAULT_SETTINGS),
      error: err.message || String(err),
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const patch = await req.json()
    const settings = await saveAppSettings(patch)
    const scheduler = await ensureGmailImportScheduler()
    return NextResponse.json({ ok: true, settings: redactSettings(settings), scheduler })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || String(err) }, { status: 500 })
  }
}
