import type { PublicTip, TipLiveDetail } from '~~/types/api'
import type { TipRow, TipStatus } from '~~/types/db'
import { getSwapStatus, type StatusResult } from './intents'

// Tip status syncing, shared by GET /api/tips/[id]/status, the deposit-submit route,
// and (later) /api/poll-pending. All database writes for tip status live here.

/** How long a tip's live 1Click check is reused before asking 1Click again. */
const RECHECK_MS = 3_000
/** Expired tips are still re-checked for this long, in case a late deposit arrives and gets processed or refunded. */
const EXPIRED_RECHECK_WINDOW_MS = 48 * 60 * 60 * 1000

const lastChecks = new Map<string, { at: number; live: StatusResult | null }>()

export const TIP_COLUMNS =
  'id, creator_id, goal_id, origin_asset_id, origin_asset_symbol, origin_chain, amount_in, amount_in_formatted, ' +
  'amount_out, amount_out_formatted, amount_out_usd, quote_out_usd, expires_at, deposit_address, deposit_memo, ' +
  'status, tipper_name, message, created_at, settled_at'

export interface TipCreatorBits {
  handle: string
  dest_asset_symbol: string
  dest_chain: string
}

export function toPublicTip(t: TipRow, c: TipCreatorBits): PublicTip {
  return {
    id: t.id,
    handle: c.handle,
    status: t.status,
    originAssetId: t.origin_asset_id,
    originSymbol: t.origin_asset_symbol,
    originChain: t.origin_chain,
    amountIn: t.amount_in_formatted ?? t.amount_in,
    amountOut: t.amount_out_formatted,
    amountOutUsd: t.amount_out_usd ?? t.quote_out_usd,
    destSymbol: c.dest_asset_symbol,
    destChain: c.dest_chain,
    depositAddress: t.deposit_address,
    depositMemo: t.deposit_memo,
    expiresAt: t.expires_at,
    createdAt: t.created_at,
    settledAt: t.settled_at,
    tipperName: t.tipper_name,
    message: t.message
  }
}

export function toLiveDetail(live: StatusResult | null): TipLiveDetail | null {
  if (!live) return null
  return {
    rawStatus: live.rawStatus,
    refundReason: live.refundReason,
    refundedAmount: live.refundedAmountFormatted,
    originTxs: live.originTxs,
    destinationTxs: live.destinationTxs
  }
}

/** pending < processing < any final state. A tip never moves backwards. */
function rank(s: TipStatus): number {
  if (s === 'pending') return 0
  if (s === 'expired') return 0.5
  if (s === 'processing') return 1
  return 2
}

function isPastDeadline(t: TipRow, now: number): boolean {
  return t.expires_at !== null && new Date(t.expires_at).getTime() < now
}

/** Whether a tip still needs checking against 1Click. */
export function needsSync(t: TipRow, now = Date.now()): boolean {
  if (t.status === 'pending' || t.status === 'processing') return true
  if (t.status === 'expired') return now - new Date(t.created_at).getTime() < EXPIRED_RECHECK_WINDOW_MS
  return false
}

/**
 * Check one tip against 1Click, write any status change, and return the fresh row.
 * Safe to call often: live checks are reused for a few seconds per tip, updates are
 * conditional on the previous status (no lost races), and statuses never go backwards.
 */
export async function syncTip(tip: TipRow, opts: { force?: boolean } = {}): Promise<{ tip: TipRow; live: StatusResult | null }> {
  const now = Date.now()
  if (!needsSync(tip, now)) return { tip, live: lastChecks.get(tip.id)?.live ?? null }

  let live: StatusResult | null
  const cached = lastChecks.get(tip.id)
  if (!opts.force && cached && now - cached.at < RECHECK_MS) {
    live = cached.live
  } else {
    live = await getSwapStatus(tip.deposit_address, tip.deposit_memo)
    lastChecks.set(tip.id, { at: now, live })
    if (lastChecks.size > 5_000) lastChecks.clear()
  }

  // 1Click does not know the address (should not happen for our own quotes): leave it, except expiry.
  let next: TipStatus = live ? live.status : tip.status
  if (next === 'pending' && isPastDeadline(tip, now)) next = 'expired'
  if (next === tip.status || rank(next) < rank(tip.status)) return { tip, live }

  const patch: Partial<TipRow> = { status: next }
  if (next === 'success') {
    if (live?.amountOut) patch.amount_out = live.amountOut
    if (live?.amountOutFormatted) patch.amount_out_formatted = live.amountOutFormatted
    // Goal math uses amount_out_usd. If 1Click does not report it, fall back to the quote's USD estimate.
    patch.amount_out_usd = live?.amountOutUsd ?? tip.quote_out_usd
  }
  if (next === 'success' || next === 'refunded' || next === 'failed') {
    patch.settled_at = new Date().toISOString()
  }

  const db = useServerSupabase()
  const { data, error } = await db
    .from('cz_tips')
    .update(patch)
    .eq('id', tip.id)
    .eq('status', tip.status) // only if nobody else moved it first
    .select(TIP_COLUMNS)
    .maybeSingle<TipRow>()
  if (error) throw dbError('update tip status', error)

  if (!data) {
    // Lost a race with another poller. Return whatever is stored now.
    const { data: fresh, error: e2 } = await db.from('cz_tips').select(TIP_COLUMNS).eq('id', tip.id).single<TipRow>()
    if (e2) throw dbError('reload tip', e2)
    return { tip: fresh, live }
  }

  if (data.status === 'success' && data.goal_id) await markGoalIfComplete(data.goal_id)
  return { tip: data, live }
}

/**
 * Goal progress is computed by the cz_goal_progress view. When a success pushes a goal
 * over its target, stamp completed_at once so the overlay can celebrate exactly once.
 */
export async function markGoalIfComplete(goalId: string): Promise<void> {
  const db = useServerSupabase()
  const { data, error } = await db
    .from('cz_goal_progress')
    .select('goal_id, target_amount, raised_usd, completed_at')
    .eq('goal_id', goalId)
    .maybeSingle()
  if (error) throw dbError('load goal progress', error)
  if (!data || data.completed_at !== null) return
  if (Number(data.raised_usd) < Number(data.target_amount)) return
  const { error: e2 } = await db
    .from('cz_goals')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', goalId)
    .is('completed_at', null)
  if (e2) throw dbError('complete goal', e2)
}

/** Load a tip plus the creator fields needed to show it. Null when the tip does not exist. */
export async function loadTip(id: string): Promise<{ tip: TipRow; creator: TipCreatorBits } | null> {
  const db = useServerSupabase()
  const { data: tip, error } = await db.from('cz_tips').select(TIP_COLUMNS).eq('id', id).maybeSingle<TipRow>()
  if (error) throw dbError('load tip', error)
  if (!tip) return null
  const { data: creator, error: e2 } = await db
    .from('cz_creators')
    .select('handle, dest_asset_symbol, dest_chain')
    .eq('id', tip.creator_id)
    .single()
  if (e2) throw dbError('load tip creator', e2)
  return { tip, creator }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(v: string | undefined): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}
