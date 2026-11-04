import type { DashboardResponse } from '~~/types/api'
import type { TipRow } from '~~/types/db'

// Creator dashboard data. Manage token required (x-manage-token header).
export default defineApiHandler(async (event): Promise<DashboardResponse> => {
  rateLimit(event, `dashboard:${clientIp(event)}`, 120, 60_000)
  const creator = await requireCreator(event, { handle: getRouterParam(event, 'handle') ?? '' })
  const db = useServerSupabase()

  const [goal, pastRes, tipsRes, totalsRes] = await Promise.all([
    getActiveGoal(creator.id),
    db.from('cz_goal_progress').select('*').eq('creator_id', creator.id).eq('active', false)
      .order('created_at', { ascending: false }).limit(5),
    db.from('cz_tips').select(TIP_COLUMNS).eq('creator_id', creator.id)
      .order('created_at', { ascending: false }).limit(25).returns<TipRow[]>(),
    db.from('cz_tips').select('amount_out_usd').eq('creator_id', creator.id).eq('status', 'success')
  ])
  if (pastRes.error) throw dbError('load past goals', pastRes.error)
  if (tipsRes.error) throw dbError('load tips', tipsRes.error)
  if (totalsRes.error) throw dbError('load totals', totalsRes.error)

  const totalUsd = totalsRes.data.reduce((sum, t) => sum + (Number(t.amount_out_usd) || 0), 0)
  const site = useRuntimeConfig(event).public.siteUrl.replace(/\/+$/, '')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    creator: toPublicCreatorInfo(creator),
    goal,
    pastGoals: pastRes.data.map(toGoalWithProgress),
    tips: tipsRes.data.map((t) => toPublicTip(t, creator)),
    totals: { successCount: totalsRes.data.length, totalUsd: Math.round(totalUsd * 100) / 100 },
    tipUrl: `${site}/${creator.handle}`,
    overlayUrl: `${site}/overlay/${creator.handle}`
  }
})
