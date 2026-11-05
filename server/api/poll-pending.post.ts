import { z } from 'zod'
import type { OverlayTip, PollPendingResponse } from '~~/types/api'
import type { TipRow } from '~~/types/db'
import { HANDLE_RE, normalizeHandle } from '~~/utils/handle'

// POST /api/poll-pending
// The overlay and dashboard call this every few seconds. It re-checks a creator's open
// tips against 1Click (so tips settle even after the fan closed their tab), then returns
// the active goal and any tips delivered since the caller's last poll.

/** Open tips older than this are left alone. */
const MAX_AGE_MS = 48 * 60 * 60 * 1000
const MAX_TIPS = 20
/** 1Click is asked at most once per creator in this window, however many overlays are open. */
const SYNC_EVERY_MS = 5_000
/** Tips synced in parallel. Keeps a burst of 20 open tips from hammering 1Click. */
const CONCURRENCY = 5

const lastSync = new Map<string, number>()

const bodySchema = z.object({
  handle: z.string({ error: 'Handle is required.' }).max(40, 'Handle is too long.'),
  since: z.iso.datetime({ offset: true, error: 'since must be an ISO date.' }).optional()
})

function toOverlayTip(t: TipRow, destSymbol: string): OverlayTip {
  return {
    id: t.id,
    tipperName: t.tipper_name,
    message: t.message,
    amountIn: t.amount_in_formatted ?? t.amount_in,
    originSymbol: t.origin_asset_symbol,
    originChain: t.origin_chain,
    amountOut: t.amount_out_formatted,
    amountOutUsd: t.amount_out_usd ?? t.quote_out_usd,
    destSymbol,
    settledAt: t.settled_at
  }
}

/** Claims this creator's sync slot. False when another poll synced moments ago. */
function claimSync(creatorId: string, now: number): boolean {
  const last = lastSync.get(creatorId)
  if (last !== undefined && now - last < SYNC_EVERY_MS) return false
  lastSync.set(creatorId, now)
  if (lastSync.size > 5_000) {
    for (const [k, at] of lastSync) if (now - at > SYNC_EVERY_MS) lastSync.delete(k)
  }
  return true
}

async function syncOpenTips(creatorId: string): Promise<{ checked: number; changed: number }> {
  const db = useServerSupabase()
  const cutoff = new Date(Date.now() - MAX_AGE_MS).toISOString()
  const { data, error } = await db
    .from('cz_tips')
    .select(TIP_COLUMNS)
    .eq('creator_id', creatorId)
    .in('status', ['pending', 'processing'])
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(MAX_TIPS)
    .returns<TipRow[]>()
  if (error) throw dbError('load open tips', error)

  let changed = 0
  const queue = [...data]
  async function worker(): Promise<void> {
    for (let tip = queue.shift(); tip; tip = queue.shift()) {
      try {
        const res = await syncTip(tip)
        if (res.tip.status !== tip.status) changed++
      } catch (err) {
        // One bad tip must not stop the others. syncTip already logs database errors.
        console.error(`[poll-pending] sync failed for tip ${tip.id}:`, err instanceof Error ? err.message : err)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, data.length) }, worker))
  return { checked: data.length, changed }
}

export default defineApiHandler(async (event): Promise<PollPendingResponse> => {
  rateLimit(event, `poll-pending:${clientIp(event)}`, 60, 60_000)
  const body = await parseBody(event, bodySchema)
  const handle = normalizeHandle(body.handle)
  if (!HANDLE_RE.test(handle)) throw notFound('Creator not found.')

  const creator = await getPublicCreator(handle)
  if (!creator) throw notFound('Creator not found.')

  // Taken before any reads, so a tip delivered while this request runs is included next time.
  const serverTime = new Date().toISOString()

  const now = Date.now()
  const throttled = !claimSync(creator.id, now)
  const { checked, changed } = throttled ? { checked: 0, changed: 0 } : await syncOpenTips(creator.id)

  let delivered: OverlayTip[] = []
  if (body.since) {
    const db = useServerSupabase()
    const { data, error } = await db
      .from('cz_tips')
      .select(TIP_COLUMNS)
      .eq('creator_id', creator.id)
      .eq('status', 'success')
      .gte('settled_at', body.since)
      .order('settled_at', { ascending: true })
      .limit(MAX_TIPS)
      .returns<TipRow[]>()
    if (error) throw dbError('load delivered tips', error)
    delivered = data.map((t) => toOverlayTip(t, creator.dest_asset_symbol))
  }

  const goal = await getActiveGoal(creator.id)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    creator: { id: creator.id, handle: creator.handle, displayName: creator.display_name, destSymbol: creator.dest_asset_symbol },
    goal,
    checked,
    changed,
    throttled,
    delivered,
    serverTime
  }
})
