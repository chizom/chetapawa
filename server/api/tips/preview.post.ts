import { z } from 'zod'
import type { TipPreviewResponse } from '~~/types/api'
import { requestQuote } from '~~/server/utils/intents'

// Dry quote: the estimated amount the creator receives. No deposit address, no database row.
const Body = z.object(tipAmountFields)

export default defineApiHandler(async (event): Promise<TipPreviewResponse> => {
  rateLimit(event, `tips-preview:${clientIp(event)}`, 60, 60_000)
  const body = await parseBody(event, Body)
  const { creator, origin, amountBase } = await resolveTip(body)

  const q = await requestQuote({
    dry: true,
    originToken: origin,
    destAssetId: creator.dest_asset_id,
    amountBase,
    recipient: creator.payout_address
  })
  return {
    amountIn: q.amountInFormatted,
    amountInUsd: q.amountInUsd,
    estimatedOut: q.amountOutFormatted,
    estimatedOutUsd: q.amountOutUsd,
    destSymbol: creator.dest_asset_symbol,
    destChain: creator.dest_chain,
    timeEstimateSec: q.timeEstimateSec
  }
})
