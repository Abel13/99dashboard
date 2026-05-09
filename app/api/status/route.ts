import { NextResponse } from 'next/server'
import { getOpportunities, readImportState } from '@/lib/softwarehouse'

export async function GET() {
  const [state, opportunities] = await Promise.all([readImportState(), getOpportunities()])
  return NextResponse.json({
    import_state: state,
    items_count: opportunities.items?.length || 0,
    feedback_applied_at: null,
  })
}
