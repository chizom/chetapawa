import { z } from 'zod'
import type { TokenInfo } from '~~/types/api'
import type { PublicCreator } from '~~/types/db'
import { HANDLE_RE, normalizeHandle } from '~~/utils/handle'
import { toBaseUnits } from '~~/utils/units'
import { findToken } from './intents'

// Shared validation for POST /api/tips/preview and POST /api/tips/quote.

export const tipAmountFields = {
  handle: z.string({ error: 'Creator handle is required.' }).max(40, 'Creator handle is too long.'),
  originAssetId: z.string({ error: 'Pick a token to pay with.' }).min(1, 'Pick a token to pay with.').max(300, 'Token id is too long.'),
  amount: z.string({ error: 'Enter an amount.' }).trim().min(1, 'Enter an amount.').max(60, 'Amount is too long.')
}

/** Trim, collapse whitespace, drop control characters. Empty becomes null. */
export function cleanText(v: string | undefined): string | null {
  if (v === undefined) return null
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
  return s === '' ? null : s
}

export interface ResolvedTip {
  creator: PublicCreator
  origin: TokenInfo
  amountBase: string
}

/** Look up the creator and origin token and convert the amount to base units, or throw a clean 4xx. */
export async function resolveTip(input: { handle: string; originAssetId: string; amount: string }): Promise<ResolvedTip> {
  const handle = normalizeHandle(input.handle)
  if (!HANDLE_RE.test(handle)) throw notFound('No tip page with that handle.')
  const creator = await getPublicCreator(handle)
  if (!creator) throw notFound('No tip page with that handle.')

  const origin = await findToken(input.originAssetId)
  if (!origin) throw badRequest('That token is not supported. Pick another one.')

  let amountBase: string
  try {
    amountBase = toBaseUnits(input.amount, origin.decimals)
  } catch (err) {
    throw badRequest(err instanceof Error ? err.message : 'Enter a valid amount.')
  }
  if (BigInt(amountBase) <= BigInt(0)) throw badRequest('Amount must be more than zero.')
  return { creator, origin, amountBase }
}
