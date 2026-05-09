import type { Feedback, Opportunity } from './domain'
import { SUPABASE_ENABLED, supabaseAdmin } from './supabase-server'

export type { Feedback, Opportunity }

function requireSupabase() {
  if (!SUPABASE_ENABLED) throw new Error('DATA_BACKEND=supabase é obrigatório nesta versão')
  return supabaseAdmin()
}

export async function upsertOpportunity(item: Opportunity) {
  const sb = requireSupabase()
  const projectId = String(item.source_project_id)
  const { data: existing, error: lookupError } = await sb.from('opportunities').select('project_id').eq('project_id', projectId).maybeSingle()
  if (lookupError) throw lookupError
  const row = {
    project_id: projectId,
    title: item.title,
    status: item.effective_status || item.decision_support?.status_manual || null,
    score: item.analysis?.final_score || null,
    price_suggested: item.decision_support?.price_suggested_effective ?? item.decision_support?.price_suggested ?? null,
    payload: item,
    source_updated_at: new Date().toISOString(),
  }
  const { error } = await sb.from('opportunities').upsert(row, { onConflict: 'project_id' })
  if (error) throw error
  return { inserted: !existing, updated: Boolean(existing), project_id: projectId }
}

export async function getOpportunities() {
  const { data, error } = await requireSupabase().from('opportunities').select('payload').order('score', { ascending: false, nullsFirst: false })
  if (error) throw error
  return { items: (data || []).map((r: any) => r.payload as Opportunity) }
}

export async function getOpportunityById(projectId: string) {
  const { data, error } = await requireSupabase().from('opportunities').select('payload').eq('project_id', projectId).maybeSingle()
  if (error) throw error
  return (data as any)?.payload as Opportunity | null
}

export async function updateFeedback(projectId: string, patch: Feedback) {
  const sb = requireSupabase()
  const { data: currentRow } = await sb.from('feedback').select('payload').eq('project_id', projectId).maybeSingle()
  const now = new Date().toISOString()
  const feedback = { ...((currentRow as any)?.payload || {}), ...patch, updated_at: now }
  const { error } = await sb.from('feedback').upsert({
    project_id: projectId,
    status: feedback.status || null,
    reason: feedback.reason || null,
    notes: feedback.notes || null,
    outcome: feedback.outcome || null,
    price_override: feedback.price_override ?? null,
    proposal_sent_price: feedback.proposal_sent_price ?? null,
    proposal_sent_at: feedback.proposal_sent_at ?? null,
    payload: feedback,
  }, { onConflict: 'project_id' })
  if (error) throw error
  const { data: opp } = await sb.from('opportunities').select('payload').eq('project_id', projectId).maybeSingle()
  if ((opp as any)?.payload) {
    const item = (opp as any).payload as Opportunity
    item.abel_feedback = feedback
    item.effective_status = feedback.status || item.effective_status
    item.effective_status_label = feedback.status ? feedback.status.replaceAll('_',' ') : item.effective_status_label
    await upsertOpportunity(item)
  }
  return feedback
}

export async function readImportState() {
  const { data, error } = await requireSupabase().from('import_state').select('payload').eq('key', 'default').maybeSingle()
  if (error) throw error
  return data?.payload || {}
}

export async function readImportRuns(limit = 10) {
  const { data, error } = await requireSupabase().from('import_runs').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data || []
}

export async function updateImportState(patch: Record<string, any>) {
  const current = await readImportState()
  const next = { ...current, ...patch, updated_at: new Date().toISOString() }
  const sb = requireSupabase()
  const { error } = await sb.from('import_state').upsert({ key: 'default', payload: next }, { onConflict: 'key' })
  if (error) throw error
  if ('last_import_at' in patch) {
    await sb.from('import_runs').insert({ kind: 'gmail', ok: patch.last_import_ok !== false, found: patch.last_found ?? null, saved: patch.last_saved ?? null, query: patch.last_query ?? null, error: patch.last_import_error ?? null, payload: patch })
  }
  return next
}

export async function runPipeline() {
  await updateImportState({ last_pipeline_at: new Date().toISOString(), last_pipeline_ok: true, last_pipeline_code: 0 })
  return { ok: true, code: 0, output: 'Pipeline legado removido. Use /api/import/gmail para importar e enriquecer direto no Supabase.' }
}
