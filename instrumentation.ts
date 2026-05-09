export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  try {
    const { ensureGmailImportScheduler } = await import('./lib/import/gmail-scheduler')
    await ensureGmailImportScheduler()
  } catch {
    // Scheduler startup must never prevent the dashboard from booting.
  }
}
