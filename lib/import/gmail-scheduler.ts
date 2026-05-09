import { getAppSettings } from '@/lib/settings'
import { updateImportState } from '@/lib/softwarehouse'
import { runGmailImport } from './gmail-runner'

type SchedulerState = {
  timer?: NodeJS.Timeout
  signature?: string
  running?: boolean
  lastTickAt?: string
  lastError?: string | null
}

declare global {
  // eslint-disable-next-line no-var
  var __softwarehouseGmailScheduler: SchedulerState | undefined
}

const MIN_INTERVAL_MINUTES = 5

function schedulerState(): SchedulerState {
  globalThis.__softwarehouseGmailScheduler ||= {}
  return globalThis.__softwarehouseGmailScheduler
}

function stopScheduler(state: SchedulerState) {
  if (state.timer) clearInterval(state.timer)
  state.timer = undefined
  state.signature = undefined
}

async function tick(state: SchedulerState) {
  if (state.running) return
  state.running = true
  state.lastTickAt = new Date().toISOString()
  try {
    const settings = await getAppSettings()
    if (!settings.gmail_auto_import_enabled) return
    await runGmailImport({ trigger: 'auto', settings })
    state.lastError = null
  } catch (err: any) {
    state.lastError = err.message || String(err)
    await updateImportState({
      last_scheduler_error_at: new Date().toISOString(),
      last_scheduler_error: state.lastError,
    }).catch(() => {})
  } finally {
    state.running = false
  }
}

export async function ensureGmailImportScheduler() {
  const state = schedulerState()
  const settings = await getAppSettings()
  const intervalMinutes = Math.max(MIN_INTERVAL_MINUTES, Number(settings.gmail_auto_import_interval_minutes || 15))
  const signature = settings.gmail_auto_import_enabled ? `enabled:${intervalMinutes}` : 'disabled'

  if (!settings.gmail_auto_import_enabled) {
    if (state.timer) stopScheduler(state)
    return {
      enabled: false,
      interval_minutes: intervalMinutes,
      running: Boolean(state.running),
      last_tick_at: state.lastTickAt,
      last_error: state.lastError || null,
    }
  }

  if (state.signature !== signature) {
    stopScheduler(state)
    state.signature = signature
    state.timer = setInterval(() => void tick(state), intervalMinutes * 60 * 1000)
    // Do not keep an otherwise-idle Node process alive just because of this timer.
    state.timer.unref?.()
    await updateImportState({
      gmail_scheduler_started_at: new Date().toISOString(),
      gmail_scheduler_interval_minutes: intervalMinutes,
    }).catch(() => {})
  }

  return {
    enabled: true,
    interval_minutes: intervalMinutes,
    running: Boolean(state.running),
    last_tick_at: state.lastTickAt,
    last_error: state.lastError || null,
  }
}
