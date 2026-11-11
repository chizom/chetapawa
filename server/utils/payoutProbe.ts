import { H3Error } from 'h3'
import type { TokenInfo } from '~~/types/api'
import { tokenAmountForUsd } from '~~/utils/format'
import { toBaseUnits } from '~~/utils/units'
import { requestQuote } from './intents'

// Real mode only: before saving a new creator, ask 1Click for one dry quote that pays their
// payout address. 1Click rejects recipients it cannot deliver to (for example a NEAR account
// that does not exist) with a bare 400. Catching that here means a creator cannot publish a
// page where every tip would fail. A dry quote creates no deposit address and moves no funds.

const PROBE_ORIGINS = ['nep141:wrap.near', 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1']
const PROBE_USD = 5

/** Returns a message when 1Click will not pay this address, or null when it will (or when we cannot tell). */
export async function probePayoutAddress(dest: TokenInfo, payoutAddress: string): Promise<string | null> {
  if (isMockMode()) return null
  let origin: TokenInfo | null = null
  for (const id of PROBE_ORIGINS) {
    if (id === dest.assetId) continue
    origin = (await findToken(id)) ?? null
    if (origin && origin.priceUsd > 0) break
  }
  if (!origin) return null

  const amountBase = toBaseUnits(tokenAmountForUsd(PROBE_USD, origin.priceUsd, origin.decimals), origin.decimals)
  try {
    await requestQuote({ dry: true, originToken: origin, destAssetId: dest.assetId, amountBase, recipient: payoutAddress })
    return null
  } catch (err) {
    // Only a 400 says something about the address. Network trouble or 5xx should not block sign-up.
    if (err instanceof H3Error && err.statusCode === 400) {
      return dest.chain === 'near'
        ? 'NEAR Intents cannot pay this account. Check that the NEAR account exists and is spelled correctly.'
        : 'NEAR Intents cannot pay this address. Check that it is your own address on the chosen chain.'
    }
    console.warn('[creators] payout probe skipped:', err instanceof Error ? err.message : err)
    return null
  }
}
