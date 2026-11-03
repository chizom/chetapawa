import type { GoalWithProgress, PublicCreatorInfo } from '~~/types/api'
import type { GoalProgressRow, PublicCreator } from '~~/types/db'

// Read helpers for creators and their active goal. Never select manage_token_hash here.

export function toPublicCreatorInfo(c: PublicCreator): PublicCreatorInfo {
  return {
    handle: c.handle,
    displayName: c.display_name,
    bio: c.bio,
    payoutAddress: c.payout_address,
    destAssetId: c.dest_asset_id,
    destAssetSymbol: c.dest_asset_symbol,
    destChain: c.dest_chain,
    createdAt: c.created_at
  }
}

export async function getPublicCreator(handle: string): Promise<PublicCreator | null> {
  const db = useServerSupabase()
  const { data, error } = await db
    .from('cz_creators')
    .select(PUBLIC_CREATOR_COLUMNS)
    .eq('handle', handle)
    .maybeSingle()
  if (error) throw dbError('load creator', error)
  return data
}

export function toGoalWithProgress(g: GoalProgressRow): GoalWithProgress {
  const target = Number(g.target_amount)
  const raised = Number(g.raised_usd) || 0
  const percent = target > 0 ? Math.min(100, Math.round((raised / target) * 1000) / 10) : 0
  return {
    id: g.goal_id,
    title: g.title,
    targetAmount: target,
    raised: Math.round(raised * 100) / 100,
    percent,
    tipCount: Number(g.tip_count) || 0,
    completed: g.completed_at !== null || raised >= target,
    completedAt: g.completed_at,
    unit: 'USD'
  }
}

export async function getActiveGoal(creatorId: string): Promise<GoalWithProgress | null> {
  const db = useServerSupabase()
  const { data, error } = await db
    .from('cz_goal_progress')
    .select('*')
    .eq('creator_id', creatorId)
    .eq('active', true)
    .maybeSingle()
  if (error) throw dbError('load goal', error)
  return data ? toGoalWithProgress(data) : null
}

/** Log the real database error server side, return a generic 500 to the client. */
export function dbError(action: string, error: { message: string; code?: string }): Error {
  console.error(`[db] ${action} failed:`, error.code ?? '', error.message)
  return createError({ statusCode: 500, statusMessage: 'Database error', data: { error: 'Something went wrong. Please try again.' } })
}
