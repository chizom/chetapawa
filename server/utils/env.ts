// Server-only environment access. Read at runtime (not at build time) so secrets
// never end up in build artifacts. Never import this from client code.

export interface ServerEnv {
  supabaseUrl: string
  supabaseServiceRoleKey: string
  oneClickApiBase: string
  oneClickJwt: string
  /** MOCK_INTENTS as set: true, false, or null when unset or blank. */
  mockIntents: boolean | null
}

export function serverEnv(): ServerEnv {
  const e = process.env
  return {
    supabaseUrl: e.NUXT_PUBLIC_SUPABASE_URL || '',
    supabaseServiceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY || '',
    oneClickApiBase: (e.ONE_CLICK_API_BASE || 'https://1click.chaindefuser.com').replace(/\/+$/, ''),
    oneClickJwt: e.ONE_CLICK_JWT || '',
    mockIntents: flag(e.MOCK_INTENTS)
  }
}

/**
 * Reads a true/false env var. Tolerates spaces, capitals and surrounding quotes,
 * which hosting dashboards make easy to add by accident. Returns null when unset,
 * blank or anything else.
 */
export function flag(value: string | undefined): boolean | null {
  const v = (value ?? '').trim().replace(/^["']|["']$/g, '').trim().toLowerCase()
  if (v === 'true') return true
  if (v === 'false') return false
  return null
}
