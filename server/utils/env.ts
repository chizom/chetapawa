// Server-only environment access. Read at runtime (not at build time) so secrets
// never end up in build artifacts. Never import this from client code.

export interface ServerEnv {
  supabaseUrl: string
  supabaseServiceRoleKey: string
  oneClickApiBase: string
  oneClickJwt: string
  mockIntents: boolean
}

export function serverEnv(): ServerEnv {
  const e = process.env
  return {
    supabaseUrl: e.NUXT_PUBLIC_SUPABASE_URL || '',
    supabaseServiceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY || '',
    oneClickApiBase: (e.ONE_CLICK_API_BASE || 'https://1click.chaindefuser.com').replace(/\/+$/, ''),
    oneClickJwt: e.ONE_CLICK_JWT || '',
    mockIntents: e.MOCK_INTENTS === 'true'
  }
}
