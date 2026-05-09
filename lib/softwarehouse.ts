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
  const { data: existing, error: lookupError } = await sb.from('opportunities').select('project_id,payload').eq('project_id', projectId).maybeSingle()
  if (lookupError) throw lookupError
  const payload = mergeOpportunityPayload((existing as any)?.payload as Opportunity | undefined, item)
  const row = {
    project_id: projectId,
    title: payload.title,
    status: payload.effective_status || payload.decision_support?.status_manual || null,
    score: payload.analysis?.final_score || null,
    price_suggested: payload.decision_support?.price_suggested_effective ?? payload.decision_support?.price_suggested ?? null,
    payload,
    source_updated_at: new Date().toISOString(),
  }
  const { error } = await sb.from('opportunities').upsert(row, { onConflict: 'project_id' })
  if (error) throw error
  return { inserted: !existing, updated: Boolean(existing), project_id: projectId, payload }
}

function mergeOpportunityPayload(existing: Opportunity | undefined, incoming: Opportunity): Opportunity {
  if (!existing) return incoming

  const existingPageIsCanonical = existing.page_details?.source === 'project_page' || existing.page_details?.description_source === 'project_page'
  const incomingPageIsCanonical = incoming.page_details?.source === 'project_page' || incoming.page_details?.description_source === 'project_page'
  const userProposal = incoming.abel_feedback?.proposal_draft || existing.abel_feedback?.proposal_draft

  const merged: Opportunity = {
    ...existing,
    ...incoming,
    analysis: { ...(existing.analysis || {}), ...(incoming.analysis || {}) },
    page_details: { ...(existing.page_details || {}), ...(incoming.page_details || {}) },
    client_details: incoming.client_details && Object.keys(incoming.client_details || {}).length ? { ...(existing.client_details || {}), ...(incoming.client_details || {}) } : existing.client_details,
    decision_support: { ...(existing.decision_support || {}), ...(incoming.decision_support || {}) },
    abel_feedback: { ...(existing.abel_feedback || {}), ...(incoming.abel_feedback || {}) },
  }

  // The project page is canonical. Do not let Gmail/import previews or partial
  // payloads erase a description already fetched from the 99Freelas page.
  if (existingPageIsCanonical && !incomingPageIsCanonical) {
    merged.full_description = existing.full_description
    merged.description_preview = existing.description_preview
    merged.page_details = { ...(merged.page_details || {}), description_source: existing.page_details?.description_source || 'project_page' }
  }

  // User-edited proposals live in feedback and must survive re-imports,
  // enrichment and AI/pricing recalculations.
  if (userProposal) {
    merged.abel_feedback = { ...(merged.abel_feedback || {}), proposal_draft: userProposal }
    merged.decision_support = { ...(merged.decision_support || {}), proposal_draft: userProposal }
  }

  // Manual workflow status is user data and should not be reset by pricing/import.
  if (merged.abel_feedback?.status) {
    merged.effective_status = merged.abel_feedback.status
    merged.effective_status_label = merged.abel_feedback.status.replaceAll('_', ' ')
  }

  // Preserve IA panel metadata unless this request generated a newer one.
  if (existing.match_insight && !incoming.match_insight) merged.match_insight = existing.match_insight
  if (existing.match_insight_generated_at && !incoming.match_insight_generated_at) merged.match_insight_generated_at = existing.match_insight_generated_at

  return merged
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
  const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Feedback
  const feedback = { ...((currentRow as any)?.payload || {}), ...cleanPatch, updated_at: now }
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
    if (feedback.proposal_draft) {
      item.decision_support = { ...(item.decision_support || {}), proposal_draft: feedback.proposal_draft }
    }
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
