import { z } from 'zod'
import type { TipResponse } from '~~/types/api'
import { submitDeposit } from '~~/server/utils/intents'

// Optional speed-up: the fan pastes their deposit transaction hash and we forward it to
// 1Click POST /v0/deposit/submit, which lets it pick up the deposit sooner.
const Body = z.object({
  txHash: z.string({ error: 'Paste your transaction hash.' }).trim()
    .min(8, 'That transaction hash looks too short.')
    .max(200, 'That transaction hash looks too long.')
    .regex(/^[A-Za-z0-9:_-]+$/, 'A transaction hash has only letters, numbers and simple symbols.'),
  nearSenderAccount: z.string({ error: 'NEAR account must be text.' }).trim().max(64, 'NEAR account is too long.').optional()
})

export default defineApiHandler(async (event): Promise<TipResponse> => {
  rateLimit(event, `tips-submit:${clientIp(event)}`, 10, 10 * 60_000)
  const id = getRouterParam(event, 'id')
  if (!isUuid(id)) throw notFound('Tip not found.')
  const body = await parseBody(event, Body)
  const found = await loadTip(id)
  if (!found) throw notFound('Tip not found.')
  if (!needsSync(found.tip)) throw badRequest('This tip is already finished.')

  await submitDeposit({
    txHash: body.txHash,
    depositAddress: found.tip.deposit_address,
    memo: found.tip.deposit_memo ?? undefined,
    nearSenderAccount: found.tip.origin_chain === 'near' && body.nearSenderAccount ? body.nearSenderAccount : undefined
  })
  const { tip, live } = await syncTip(found.tip, { force: true })
  return { tip: toPublicTip(tip, found.creator), live: toLiveDetail(live) }
})
