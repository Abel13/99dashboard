import { NextRequest, NextResponse } from 'next/server'
import { getAppSettings, saveAppSettings } from '@/lib/settings'

export async function GET() {
  const settings = await getAppSettings({ redact: true })
  return NextResponse.json({ settings })
}

export async function POST(req: NextRequest) {
  try {
    const patch = await req.json()
    const settings = await saveAppSettings(patch)
    return NextResponse.json({ ok: true, settings })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || String(err) }, { status: 500 })
  }
}
