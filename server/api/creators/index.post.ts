import { z } from 'zod'
import type { CreateCreatorResponse } from '~~/types/api'
import { checkAddress } from '~~/utils/address'
import { checkHandle, normalizeHandle } from '~~/utils/handle'

// POST /api/creators
// Creates a creator page. Returns the raw manage token exactly once.

const Body = z.object({
  handle: z.string({ error: 'Handle is required.' }).max(40, 'Handle is too long.'),
  displayName: z.string({ error: 'Display name is required.' }).trim()
    .min(1, 'Display name is required.').max(60, 'Display name is too long (max 60).'),
  bio: z.string({ error: 'Bio must be text.' }).trim().max(280, 'Bio is too long (max 280).').optional(),
  payoutAddress: z.string({ error: 'Payout address is required.' }).trim()
    .min(1, 'Payout address is required.').max(128, 'That address is too long.'),
  destAssetId: z.string({ error: 'Pick the token you want to receive.' }).trim()
    .min(1, 'Pick the token you want to receive.').max(200)
})

export default defineApiHandler(async (event): Promise<CreateCreatorResponse> => {
  rateLimit(event, `creators:${clientIp(event)}`, 5, 10 * 60_000)

  const body = await parseBody(event, Body)
  const handle = normalizeHandle(body.handle)
  const handleProblem = checkHandle(handle)
  if (handleProblem) throw badRequest(handleProblem)

  // Never trust a symbol or chain from the client: derive both from the 1Click token list.
  const token = await findToken(body.destAssetId)
  if (!token) throw badRequest('That token is not supported. Pick another one.')

  const addressProblem = checkAddress(token.chain, body.payoutAddress)
  if (addressProblem) throw badRequest(addressProblem)

  const db = useServerSupabase()
  if (await getPublicCreator(handle)) throw badRequest('That handle is taken. Try another.')

  const payoutProblem = await probePayoutAddress(token, body.payoutAddress)
  if (payoutProblem) throw badRequest(payoutProblem)

  const manageToken = generateManageToken()
  const { data, error } = await db
    .from('cz_creators')
    .insert({
      handle,
      display_name: body.displayName,
      bio: body.bio ? body.bio : null,
      payout_address: body.payoutAddress,
      dest_asset_id: token.assetId,
      dest_asset_symbol: token.symbol,
      dest_chain: token.chain,
      manage_token_hash: hashManageToken(manageToken)
    })
    .select(PUBLIC_CREATOR_COLUMNS)
    .single()

  if (error) {
    // Lost a race on the unique handle index.
    if (error.code === '23505') throw badRequest('That handle is taken. Try another.')
    throw dbError('create creator', error)
  }

  const site = siteBase(event)
  setResponseStatus(event, 201)
  return {
    creator: toPublicCreatorInfo(data),
    manageToken,
    tipUrl: `${site}/${handle}`,
    manageUrl: `${site}/${handle}/manage`,
    overlayUrl: `${site}/overlay/${handle}`
  }
})
