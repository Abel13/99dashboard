import { SUPABASE_ENABLED, supabaseAdmin } from './supabase-server'

export type AppSettings = {
  profile_username: string
  hourly_rate: number
  platform_fee_pct: number
  profile_efficiency_pct: number
  ai_pricing_enabled: boolean
  ai_pricing_model: string
  chat_ai_model: string
  openai_api_key: string
  openai_configured: boolean
  gmail_client_id: string
  gmail_client_secret: string
  gmail_refresh_token: string
  gmail_configured: boolean
  gmail_query: string
  dashboard_api_token: string
  dashboard_api_token_configured: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  profile_username: 'abeldutraui',
  hourly_rate: Number(process.env.PRICING_HOURLY_RATE || 130),
  platform_fee_pct: Number(process.env.PRICING_PLATFORM_FEE_PCT || 0.2),
  profile_efficiency_pct: 72,
  ai_pricing_enabled: /^(1|true|yes|on)$/i.test(process.env.AI_PRICING_ENABLED || 'false'),
  ai_pricing_model: process.env.AI_PRICING_MODEL || 'gpt-4o-mini',
  chat_ai_model: process.env.CHAT_AI_MODEL || process.env.AI_PRICING_MODEL || 'gpt-4o-mini',
  openai_api_key: process.env.OPENAI_API_KEY || '',
  openai_configured: Boolean(process.env.OPENAI_API_KEY),
  gmail_client_id: process.env.GMAIL_CLIENT_ID || '',
  gmail_client_secret: process.env.GMAIL_CLIENT_SECRET || '',
  gmail_refresh_token: process.env.GMAIL_REFRESH_TOKEN || '',
  gmail_configured: Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN),
  gmail_query: process.env.GMAIL_LABEL_OR_QUERY || 'from:(99freelas.com.br) newer_than:7d',
  dashboard_api_token: process.env.DASHBOARD_API_TOKEN || process.env.AUTO_IMPORT_CRON_SECRET || '',
  dashboard_api_token_configured: Boolean(process.env.DASHBOARD_API_TOKEN || process.env.AUTO_IMPORT_CRON_SECRET),
}

const SECRET_KEYS = ['openai_api_key','gmail_client_id','gmail_client_secret','gmail_refresh_token','dashboard_api_token']

export function redactSettings(settings: AppSettings) {
  const copy: any = { ...settings }
  for (const key of SECRET_KEYS) if (copy[key]) copy[key] = '••••••••'
  return copy as AppSettings
}

export async function getAppSettings(options?: { redact?: boolean }): Promise<AppSettings> {
  let settings = { ...DEFAULT_SETTINGS }
  if (SUPABASE_ENABLED) {
    try {
      const { data } = await supabaseAdmin().from('app_settings').select('payload').eq('key', 'default').maybeSingle()
      settings = { ...settings, ...((data as any)?.payload || {}) }
    } catch {
      // Migration may not have been applied yet; keep env/default fallback.
    }
  }
  // Secrets never come from Supabase. They are runtime-only env values.
  settings.openai_api_key = process.env.OPENAI_API_KEY || ''
  settings.openai_configured = Boolean(settings.openai_api_key)
  settings.gmail_client_id = process.env.GMAIL_CLIENT_ID || ''
  settings.gmail_client_secret = process.env.GMAIL_CLIENT_SECRET || ''
  settings.gmail_refresh_token = process.env.GMAIL_REFRESH_TOKEN || ''
  settings.gmail_configured = Boolean(settings.gmail_client_id && settings.gmail_client_secret && settings.gmail_refresh_token)
  settings.dashboard_api_token = process.env.DASHBOARD_API_TOKEN || process.env.AUTO_IMPORT_CRON_SECRET || ''
  settings.dashboard_api_token_configured = Boolean(settings.dashboard_api_token)
  settings.hourly_rate = Number(settings.hourly_rate || 130)
  settings.platform_fee_pct = Number(settings.platform_fee_pct || 0.2)
  settings.profile_efficiency_pct = Number(settings.profile_efficiency_pct || 0)
  return options?.redact ? redactSettings(settings) : settings
}

export async function saveAppSettings(patch: Partial<AppSettings>) {
  if (!SUPABASE_ENABLED) throw new Error('Supabase é obrigatório para salvar configurações')
  const current = await getAppSettings()
  const clean: any = { ...patch }
  // Never persist credentials/API keys in Supabase. They must stay in .env/runtime secrets.
  for (const key of SECRET_KEYS) delete clean[key]
  delete clean.openai_configured
  delete clean.gmail_configured
  delete clean.dashboard_api_token_configured
  const next = { ...current, ...clean }
  for (const key of SECRET_KEYS) delete (next as any)[key]
  delete (next as any).openai_configured
  delete (next as any).gmail_configured
  delete (next as any).dashboard_api_token_configured
  const { error } = await supabaseAdmin().from('app_settings').upsert({ key: 'default', payload: next }, { onConflict: 'key' })
  if (error) throw error
  return next as AppSettings
}
