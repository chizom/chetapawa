import { z } from 'zod'
import type { GoalResponse } from '~~/types/api'
import { goalTarget, goalTitle } from '~~/server/utils/goalInput'

// Create the creator's one active goal. Any previous active goal is ended first.
// The partial unique index cz_goals_one_active_per_creator guarantees at most one active goal.
const Body = z.object({
  handle: z.string({ error: 'Creator handle is required.' }).max(40, 'Creator handle is too long.'),
  title: goalTitle,
  targetAmount: goalTarget
})

export default defineApiHandler(async (event): Promise<GoalResponse> => {
  rateLimit(event, `goals-write:${clientIp(event)}`, 30, 10 * 60_000)
  const body = await parseBody(event, Body)
  const creator = await requireCreator(event, { handle: body.handle })
  const db = useServerSupabase()

  // Two tries: if a concurrent request created a goal between our two statements,
  // the unique index rejects our insert (23505) and we end that one and retry once.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error: endErr } = await db
      .from('cz_goals')
      .update({ active: false })
      .eq('creator_id', creator.id)
      .eq('active', true)
    if (endErr) throw dbError('end previous goal', endErr)

    const { data, error } = await db
      .from('cz_goals')
      .insert({ creator_id: creator.id, title: body.title, target_amount: body.targetAmount })
      .select('id')
      .single()
    if (error?.code === '23505' && attempt === 0) continue
    if (error) throw dbError('create goal', error)

    const goal = await getGoalProgress(data.id)
    if (!goal) throw dbError('reload goal', { message: 'missing after insert' })
    setResponseStatus(event, 201)
    return { goal }
  }
  throw createError({ statusCode: 409, statusMessage: 'Conflict', data: { error: 'Another change happened at the same time. Try again.' } })
})
