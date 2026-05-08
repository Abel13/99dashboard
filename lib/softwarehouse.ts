import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { paths } from './paths'
import { SUPABASE_ENABLED, supabaseAdmin } from './supabase-server'

export type Status = 'new'|'review'|'liked'|'discarded'|'prepare_proposal'|'proposal_sent'|'won'|'lost'
export type Feedback = { status?: Status; reason?: string; notes?: string; outcome?: string; price_override?: number; proposal_sent_price?: number; proposal_sent_at?: string; updated_at?: string }
export type Opportunity = Record<string, any> & { source_project_id: string; title: string; effective_status?: string; decision_support?: Record<string, any>; abel_feedback?: Feedback }

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) as T } catch { return fallback }
}
export async function writeJson(file: string, data: unknown) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8') }

async function readLocalOpportunities() { return readJson<{ items: Opportunity[]; feedback_applied_at?: string }>(paths.opportunities, { items: [] }) }

export async function syncOpportunitiesToSupabase() {
  if (!SUPABASE_ENABLED) return
  const data = await readLocalOpportunities()
  const rows = (data.items || []).map((item) => ({
    project_id: String(item.source_project_id || ''),
    title: item.title || '',
    status: item.effective_status || item.decision_support?.status_manual || null,
    score: item.analysis?.final_score || null,
    price_suggested: item.decision_support?.price_suggested_effective ?? item.decision_support?.price_suggested ?? null,
    payload: item,
    source_updated_at: data.feedback_applied_at || new Date().toISOString(),
  })).filter(r => r.project_id)
  if (!rows.length) return
  const { error } = await supabaseAdmin().from('opportunities').upsert(rows, { onConflict: 'project_id' })
  if (error) throw error
}

export async function getOpportunities() {
  if (SUPABASE_ENABLED) {
    const { data, error } = await supabaseAdmin().from('opportunities').select('payload').order('score', { ascending: false, nullsFirst: false })
    if (error) throw error
    return { items: (data || []).map((r: any) => r.payload as Opportunity) }
  }
  return readLocalOpportunities()
}

export async function updateFeedback(projectId: string, patch: Feedback) {
  const data = await readJson<{ schema_version: number; updated_at?: string; items: Record<string, Feedback> }>(paths.feedback, { schema_version: 1, items: {} })
  const now = new Date().toISOString()
  data.items[projectId] = { ...(data.items[projectId] || {}), ...patch, updated_at: now }
  data.updated_at = now
  await writeJson(paths.feedback, data)
  if (SUPABASE_ENABLED) {
    const row = {
      project_id: projectId,
      status: data.items[projectId].status || null,
      reason: data.items[projectId].reason || null,
      notes: data.items[projectId].notes || null,
      outcome: data.items[projectId].outcome || null,
      price_override: data.items[projectId].price_override ?? null,
      proposal_sent_price: data.items[projectId].proposal_sent_price ?? null,
      proposal_sent_at: data.items[projectId].proposal_sent_at ?? null,
      payload: data.items[projectId],
    }
    const { error } = await supabaseAdmin().from('feedback').upsert(row, { onConflict: 'project_id' })
    if (error) throw error
  }
  return data.items[projectId]
}

export async function readImportState() {
  if (SUPABASE_ENABLED) {
    const { data, error } = await supabaseAdmin().from('import_state').select('payload').eq('key', 'default').maybeSingle()
    if (error) throw error
    return data?.payload || {}
  }
  return readJson<Record<string, any>>(paths.importState, {})
}

export async function updateImportState(patch: Record<string, any>) {
  const current = await readImportState()
  const next = { ...current, ...patch, updated_at: new Date().toISOString() }
  await writeJson(paths.importState, next)
  if (SUPABASE_ENABLED) {
    const { error } = await supabaseAdmin().from('import_state').upsert({ key: 'default', payload: next }, { onConflict: 'key' })
    if (error) throw error
    if ('last_import_at' in patch) {
      await supabaseAdmin().from('import_runs').insert({
        kind: 'gmail', ok: patch.last_import_ok !== false, found: patch.last_found ?? null, saved: patch.last_saved ?? null,
        query: patch.last_query ?? null, error: patch.last_import_error ?? null, payload: patch,
      })
    }
  }
  return next
}

export function runPipeline(): Promise<{ ok: boolean; code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(paths.pipeline, {
      cwd: process.cwd(),
      shell: true,
      env: { ...process.env, SOFTWAREHOUSE_WORKSPACE: paths.workspace, SOFTWAREHOUSE_PIPELINE: paths.pipeline, SOFTWAREHOUSE_FEEDBACK: paths.feedback, SOFTWAREHOUSE_OPPORTUNITIES: paths.opportunities, SOFTWAREHOUSE_EML_DIR: paths.emlDir },
    })
    let output = ''
    child.stdout.on('data', d => output += d.toString())
    child.stderr.on('data', d => output += d.toString())
    child.on('close', async code => {
      const result = { ok: code === 0, code, output }
      if (result.ok) await syncOpportunitiesToSupabase()
      await updateImportState({ last_pipeline_at: new Date().toISOString(), last_pipeline_ok: result.ok, last_pipeline_code: code })
      resolve(result)
    })
  })
}
