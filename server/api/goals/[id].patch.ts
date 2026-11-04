import { z } from 'zod'
import type { GoalResponse } from '~~/types/api'
import type { GoalRow } from '~~/types/db'
import { goalTarget, goalTitle } from '~~/server/utils/goalInput'

// Edit the active goal's title or target, or end it. Manage token required.
const Body = z.object({
  title: goalTitle.optional(),
  targetAmount: goalTarget.optional(),
  end: z.boolean({ error: '"end" must be true or false.' }).optional()
}).refine((b) => b.title !== undefined || b.targetAmount !== undefined || b.end === true, {
  error: 'Nothing to change. Send a new title, a new target, or end the goal.'
})

export default defineApiHandler(async (event): Promise<GoalResponse> => {
  rateLimit(event, `goals-write:${clientIp(event)}`, 30, 10 * 60_000)
  const id = getRouterParam(event, 'id')
  if (!isUuid(id)) throw notFound('Goal not found.')
  const body = await parseBody(event, Body)

  const db = useServerSupabase()
  const { data: existing, error: loadErr } = await db
    .from('cz_goals')
    .select('id, creator_id, title, target_amount, active, created_at, completed_at')
    .eq('id', id)
    .maybeSingle<GoalRow>()
  if (loadErr) throw dbError('load goal', loadErr)
  if (!existing) throw notFound('Goal not found.')

  // Authenticate against the goal's owner, so one creator's token can never touch another's goal.
  await requireCreator(event, { id: existing.creator_id })
  if (!existing.active) throw badRequest('This goal has already ended. Create a new one instead.')

  const patch: Partial<GoalRow> = {}
  if (body.title !== undefined) patch.title = body.title
  if (body.targetAmount !== undefined) patch.target_amount = body.targetAmount
  if (body.end) patch.active = false

  const { error } = await db.from('cz_goals').update(patch).eq('id', id).eq('active', true)
  if (error) throw dbError('update goal', error)

  // A lower target can complete the goal now. A higher target than what is raised reopens a completed goal.
  if (body.targetAmount !== undefined && !body.end) {
    const current = await getGoalProgress(id)
    if (current) {
      const raised = current.raised
      if (raised >= body.targetAmount) await markGoalIfComplete(id)
      else if (existing.completed_at !== null) {
        const { error: reopenErr } = await db.from('cz_goals').update({ completed_at: null }).eq('id', id)
        if (reopenErr) throw dbError('reopen goal', reopenErr)
      }
    }
  }

  const goal = await getGoalProgress(id)
  if (!goal) throw notFound('Goal not found.')
  return { goal }
})
