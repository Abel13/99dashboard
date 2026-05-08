import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import { paths } from './paths'

export type Status = 'new'|'review'|'liked'|'discarded'|'prepare_proposal'|'proposal_sent'|'won'|'lost'
export type Feedback = { status?: Status; reason?: string; notes?: string; outcome?: string; price_override?: number; proposal_sent_price?: number; proposal_sent_at?: string; updated_at?: string }
export type Opportunity = Record<string, any> & { source_project_id: string; title: string; effective_status?: string; decision_support?: Record<string, any>; abel_feedback?: Feedback }

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) as T } catch { return fallback }
}
export async function writeJson(file: string, data: unknown) { await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8') }
export async function getOpportunities() {
  return readJson<{ items: Opportunity[]; feedback_applied_at?: string }>(paths.opportunities, { items: [] })
}
export async function updateFeedback(projectId: string, patch: Feedback) {
  const data = await readJson<{ schema_version: number; updated_at?: string; items: Record<string, Feedback> }>(paths.feedback, { schema_version: 1, items: {} })
  const now = new Date().toISOString()
  data.items[projectId] = { ...(data.items[projectId] || {}), ...patch, updated_at: now }
  data.updated_at = now
  await writeJson(paths.feedback, data)
  return data.items[projectId]
}
export function runPipeline(): Promise<{ ok: boolean; code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(paths.pipeline, { cwd: paths.workspace, shell: true })
    let output = ''
    child.stdout.on('data', d => output += d.toString())
    child.stderr.on('data', d => output += d.toString())
    child.on('close', code => resolve({ ok: code === 0, code, output }))
  })
}
