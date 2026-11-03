import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~~/types/db'

// Server-only Supabase client using the service role key.
// This file lives under server/ so it is never bundled for the browser.

let client: SupabaseClient<Database> | null = null

export function useServerSupabase(): SupabaseClient<Database> {
  if (client) return client

  const { supabaseUrl: url, supabaseServiceRoleKey: key } = serverEnv()

  if (!url || !key) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Database is not configured',
      data: { error: 'Database is not configured. Set NUXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' }
    })
  }

  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
  return client
}

/** Columns that are safe to return from public API routes. Never includes manage_token_hash. */
export const PUBLIC_CREATOR_COLUMNS =
  'id, handle, display_name, bio, payout_address, dest_asset_id, dest_asset_symbol, dest_chain, created_at'
