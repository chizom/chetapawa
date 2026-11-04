import type { TipResponse } from '~~/types/api'

// Polls 1Click for this tip's deposit address, maps the status, stores any change,
// and on success fills amount_out and settled_at and marks the goal complete if reached.
export default defineApiHandler(async (event): Promise<TipResponse> => {
  rateLimit(event, `tips-status:${clientIp(event)}`, 120, 60_000)
  const id = getRouterParam(event, 'id')
  if (!isUuid(id)) throw notFound('Tip not found.')
  const found = await loadTip(id)
  if (!found) throw notFound('Tip not found.')

  const { tip, live } = await syncTip(found.tip)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { tip: toPublicTip(tip, found.creator), live: toLiveDetail(live) }
})
