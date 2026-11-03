import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~~/types/db'

// Browser Supabase client using the public anon key.
// Read-only by design: RLS has no write policies for anon.
// Used for realtime subscriptions on cz_tips and cz_goals.

let client: SupabaseClient<Database> | null = null

export function useSupabase(): SupabaseClient<Database> | null {
  if (import.meta.server) return null
  if (client) return client

  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl
  const key = config.public.supabaseAnonKey
  if (!url || !key) {
    console.warn('[supabase] NUXT_PUBLIC_SUPABASE_URL or NUXT_PUBLIC_SUPABASE_ANON_KEY is missing. Realtime is off.')
    return null
  }

  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  return client
}
