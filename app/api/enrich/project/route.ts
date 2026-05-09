import { NextRequest, NextResponse } from 'next/server'
import { enrichProjectAndClient } from '@/lib/import/project-enricher'
import { enrichOpportunity } from '@/lib/pricing'
import { getOpportunityById, upsertOpportunity } from '@/lib/softwarehouse'

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()
    if (!projectId) return NextResponse.json({ ok: false, error: 'projectId obrigatório' }, { status: 400 })

    const item = await getOpportunityById(String(projectId))
    if (!item) return NextResponse.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 })
    if (!item.project_url) return NextResponse.json({ ok: false, error: 'Projeto sem project_url para enriquecer' }, { status: 400 })

    const pageEnriched = await enrichProjectAndClient(item)
    const enriched = await enrichOpportunity(pageEnriched)
    const saved = await upsertOpportunity(enriched)

    return NextResponse.json({ ok: true, item: saved.payload || enriched })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || String(err) }, { status: 500 })
  }
}
