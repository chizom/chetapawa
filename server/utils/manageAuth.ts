import type { H3Event } from 'h3'
import type { PublicCreator } from '~~/types/db'
import { HANDLE_RE, normalizeHandle } from '~~/utils/handle'

// Creator authentication for write routes. The raw manage token arrives in the
// x-manage-token header and is checked against the stored sha256 hash in constant time.

const FAIL_LIMIT = 10
const FAIL_WINDOW_MS = 10 * 60_000

function unauthorized(): Error {
  return createError({ statusCode: 401, statusMessage: 'Unauthorized', data: { error: 'That manage token is not valid for this page.' } })
}

/** Verify the x-manage-token header for a creator identified by handle or id. Returns the creator without its hash. */
export async function requireCreator(event: H3Event, by: { handle?: string; id?: string }): Promise<PublicCreator> {
  const ip = clientIp(event)
  const failKey = `manage-fail:${ip}`
  // Lock out an IP after repeated bad tokens. Successful requests are not counted.
  assertUnderLimit(event, failKey, FAIL_LIMIT)

  const token = getHeader(event, 'x-manage-token')?.trim() ?? ''
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', data: { error: 'Enter your manage token.' } })
  }

  const db = useServerSupabase()
  let query = db.from('cz_creators').select(`${PUBLIC_CREATOR_COLUMNS}, manage_token_hash`)
  if (by.id) {
    query = query.eq('id', by.id)
  } else {
    const handle = normalizeHandle(by.handle ?? '')
    if (!HANDLE_RE.test(handle)) throw notFound('Creator not found.')
    query = query.eq('handle', handle)
  }
  const { data, error } = await query.maybeSingle()
  if (error) throw dbError('load creator for auth', error)
  if (!data) throw notFound('Creator not found.')

  if (!verifyManageToken(token, data.manage_token_hash)) {
    rateLimit(event, failKey, FAIL_LIMIT, FAIL_WINDOW_MS)
    throw unauthorized()
  }
  const { manage_token_hash: _hash, ...creator } = data
  return creator
}
