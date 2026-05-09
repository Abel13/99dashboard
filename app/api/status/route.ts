import { NextResponse } from 'next/server'
import { getOpportunities, readImportRuns, readImportState } from '@/lib/softwarehouse'
import { getAppSettings } from '@/lib/settings'

export async function GET() {
  const [state, opportunities, runs, settings] = await Promise.all([readImportState(), getOpportunities(), readImportRuns(12), getAppSettings({ redact: true })])
  return NextResponse.json({
    import_state: state,
    import_runs: runs,
    gmail: {
      configured: settings.gmail_configured,
      query: settings.gmail_query,
      last_import_at: state.last_import_at,
      last_found: state.last_found,
      last_parsed: state.last_parsed,
      last_saved: state.last_saved,
      last_ok: state.last_import_ok,
      last_error: state.last_import_error,
      last_errors: state.last_errors || [],
    },
    items_count: opportunities.items?.length || 0,
    feedback_applied_at: null,
  })
}
