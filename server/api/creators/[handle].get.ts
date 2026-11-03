import type { CreatorPublicResponse } from '~~/types/api'
import { HANDLE_RE, normalizeHandle } from '~~/utils/handle'

// GET /api/creators/:handle
// Public creator info plus the active goal and its progress. Never includes secrets.
export default defineApiHandler(async (event): Promise<CreatorPublicResponse> => {
  const handle = normalizeHandle(getRouterParam(event, 'handle') ?? '')
  if (!HANDLE_RE.test(handle)) throw notFound('Creator not found.')

  const creator = await getPublicCreator(handle)
  if (!creator) throw notFound('Creator not found.')

  const goal = await getActiveGoal(creator.id)
  return { creator: toPublicCreatorInfo(creator), goal }
})
