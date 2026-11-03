import type { AppConfigResponse } from '~~/types/api'

/** Public runtime flags from /api/config. Shared across components via the key. */
export function useAppFlags() {
  return useFetch<AppConfigResponse>('/api/config', {
    key: 'app-flags',
    default: () => ({ mock: false })
  })
}
