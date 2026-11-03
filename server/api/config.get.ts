import type { AppConfigResponse } from '~~/types/api'

// GET /api/config
// Public, non-secret runtime flags for the UI (e.g. whether to show the MOCK badge).
export default defineApiHandler((): AppConfigResponse => {
  return { mock: isMockMode() }
})
