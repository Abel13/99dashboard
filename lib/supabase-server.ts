import { createClient } from '@supabase/supabase-js'

export const DATA_BACKEND = process.env.DATA_BACKEND || 'local'
export const SUPABASE_ENABLED = DATA_BACKEND === 'supabase'

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
