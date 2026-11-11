import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~~/types/db'
import { createLocalDb } from './localDb'

// Server-side database client.
// With NUXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set, this is a real Supabase
// client using the service role key. Without them, it is the local fallback store in
// server/utils/localDb.ts, so the app runs from a clean clone with no accounts.
// This file lives under server/ so it is never bundled for the browser.

let client: SupabaseClient<Database> | null = null

/** True when Supabase keys are missing and the local fallback store is used. */
export function isLocalStore(): boolean {
  const { supabaseUrl, supabaseServiceRoleKey } = serverEnv()
  return !supabaseUrl || !supabaseServiceRoleKey
}

export function useServerSupabase(): SupabaseClient<Database> {
  if (client) return client

  if (isLocalStore()) {
    // The local store implements only the query builder methods this app calls,
    // with the same { data, error } results, so it stands in for the typed client.
    client = createLocalDb() as unknown as SupabaseClient<Database>
    return client
  }

  const { supabaseUrl: url, supabaseServiceRoleKey: key } = serverEnv()
  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
  return client
}

/** Columns that are safe to return from public API routes. Never includes manage_token_hash. */
export const PUBLIC_CREATOR_COLUMNS =
  'id, handle, display_name, bio, payout_address, dest_asset_id, dest_asset_symbol, dest_chain, created_at'
