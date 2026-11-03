import type { TokensResponse } from '~~/types/api'

// GET /api/tokens
// Supported tokens from the 1Click API (or mock list), cached in memory for 10 minutes.
// Used for both the origin (fan) and destination (creator) pickers.
export default defineApiHandler(async (event): Promise<TokensResponse> => {
  const tokens = await getTokens()
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
  return { tokens, mock: isMockMode() }
})
