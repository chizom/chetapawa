import { z } from 'zod'
import type { TipResponse } from '~~/types/api'
import type { TipRow } from '~~/types/db'
import { checkAddress } from '~~/utils/address'
import { requestQuote } from '~~/server/utils/intents'

// Real quote (dry: false). 1Click returns a one-time deposit address. The recipient is always
// the creator's own payout address, and refunds go to the fan's own address on the origin chain.
// No address we control ever appears in the quote.
const Body = z.object({
  ...tipAmountFields,
  refundAddress: z.string({ error: 'Enter your refund address.' }).trim().min(1, 'Enter your refund address.').max(200, 'Refund address is too long.'),
  tipperName: z.string({ error: 'Name must be text.' }).max(40, 'Name can be at most 40 characters.').optional(),
  message: z.string({ error: 'Message must be text.' }).max(140, 'Message can be at most 140 characters.').optional()
})

export default defineApiHandler(async (event): Promise<TipResponse> => {
  const ip = clientIp(event)
  rateLimit(event, `tips-quote:${ip}`, 10, 10 * 60_000)
  const body = await parseBody(event, Body)
  const { creator, origin, amountBase } = await resolveTip(body)
  rateLimit(event, `tips-quote-handle:${creator.handle}`, 60, 10 * 60_000)

  const refundProblem = checkAddress(origin.chain, body.refundAddress)
  if (refundProblem) throw badRequest(`Refund address: ${refundProblem}`)

  const tipperName = cleanText(body.tipperName)
  const message = cleanText(body.message)

  const db = useServerSupabase()
  const { data: goal, error: goalErr } = await db
    .from('cz_goals')
    .select('id')
    .eq('creator_id', creator.id)
    .eq('active', true)
    .maybeSingle()
  if (goalErr) throw dbError('load active goal', goalErr)

  const q = await requestQuote({
    dry: false,
    originToken: origin,
    destAssetId: creator.dest_asset_id,
    amountBase,
    recipient: creator.payout_address,
    refundTo: body.refundAddress
  })
  if (!q.depositAddress) {
    console.error('[tips] 1Click returned a real quote without a deposit address', q.correlationId)
    throw createError({ statusCode: 502, statusMessage: 'No deposit address', data: { error: 'Swap provider did not return a deposit address. Try again.' } })
  }

  const { data: tip, error } = await db
    .from('cz_tips')
    .insert({
      creator_id: creator.id,
      goal_id: goal?.id ?? null,
      origin_asset_id: origin.assetId,
      origin_asset_symbol: origin.symbol,
      origin_chain: origin.chain,
      amount_in: q.amountIn,
      amount_in_formatted: q.amountInFormatted,
      amount_out_formatted: q.amountOutFormatted,
      quote_out_usd: q.amountOutUsd,
      expires_at: q.deadline,
      deposit_address: q.depositAddress,
      deposit_memo: q.depositMemo,
      status: 'pending',
      tipper_name: tipperName,
      message
    })
    .select(TIP_COLUMNS)
    .single<TipRow>()
  // The quote is unfunded at this point, so a failed insert loses nothing: the address simply lapses.
  if (error) throw dbError('insert tip', error)

  setResponseStatus(event, 201)
  return { tip: toPublicTip(tip, creator), live: null, timeEstimateSec: q.timeEstimateSec }
})
