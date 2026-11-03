// NEAR Intents 1Click API wrapper. The ONLY file that talks to 1Click.
//
// Source of truth for every field name below:
//   https://1click.chaindefuser.com/docs/v0/openapi.yaml  (fetched 2026-11-03)
//   https://docs.near-intents.org/integration/distribution-channels/1click-api
// Verified against the live API with dry quotes and one undeposited real quote.
//
// Facts this file relies on (all confirmed):
//   - GET  /v0/tokens  needs no auth. Fields: assetId, decimals, blockchain, symbol, price, priceUpdatedAt, contractAddress?
//   - POST /v0/quote   required: dry, swapType, slippageTolerance (bps), originAsset, depositType,
//                      destinationAsset, amount (integer base units), refundTo, refundType,
//                      recipient, recipientType, deadline (ISO).
//                      refundTo is validated against refundType's address format.
//                      Stellar origins require depositMode MEMO ("Incorrect depositMode" otherwise).
//                      Response: { quote: { depositAddress?, depositMemo?, amountIn*, amountOut*, minAmountOut,
//                      deadline?, timeEstimate, ... }, quoteRequest, signature, timestamp, correlationId }.
//                      The returned quote.deadline can be later than the one requested; it is authoritative.
//   - GET  /v0/status?depositAddress=&depositMemo=  -> { status, updatedAt, swapDetails, quoteResponse }.
//                      404 when the deposit address is unknown. swapDetails fields may be null.
//   - POST /v0/deposit/submit { txHash, depositAddress, nearSenderAccount?, memo? } (optional speed-up).
//   - Auth is optional. Without a partner JWT every quote carries an extra 0.25% fee.
//     The SDK sends OpenAPI.TOKEN as "Authorization: Bearer", which the docs say is accepted.

import {
  ApiError,
  OneClickService,
  OpenAPI,
  QuoteRequest,
  type GetExecutionStatusResponse,
  type QuoteResponse,
  type SwapDetails,
  type TokenResponse
} from '@defuse-protocol/one-click-sdk-typescript'
import type { OneClickStatus, TokenInfo, TxLink } from '~~/types/api'
import type { TipStatus } from '~~/types/db'
import { fromBaseUnits, toBaseUnits } from '~~/utils/units'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface QuoteInput {
  /** true = estimate only, no deposit address is created. */
  dry: boolean
  originToken: TokenInfo
  destAssetId: string
  /** Integer string in the origin token's base units. */
  amountBase: string
  /** Creator's own payout address on the destination chain. Funds always go here. */
  recipient: string
  /**
   * The fan's own address on the origin chain, used if the swap fails.
   * Required when dry is false. Ignored for dry previews.
   */
  refundTo?: string
}

export interface QuoteResult {
  depositAddress: string | null
  depositMemo: string | null
  amountIn: string
  amountInFormatted: string
  amountInUsd: number | null
  amountOut: string
  amountOutFormatted: string
  amountOutUsd: number | null
  minAmountOut: string
  /** When the deposit address stops accepting funds (ISO). Null for dry quotes. */
  deadline: string | null
  timeEstimateSec: number
  /** 1Click signature over the quote. Keep it for dispute resolution. */
  signature: string | null
  correlationId: string | null
}

export interface StatusResult {
  rawStatus: OneClickStatus
  status: TipStatus
  updatedAt: string
  amountOut: string | null
  amountOutFormatted: string | null
  amountOutUsd: number | null
  depositedAmountFormatted: string | null
  refundedAmountFormatted: string | null
  refundReason: string | null
  originTxs: TxLink[]
  destinationTxs: TxLink[]
}

export interface SubmitDepositInput {
  txHash: string
  depositAddress: string
  memo?: string
  nearSenderAccount?: string
}

// ---------------------------------------------------------------------------
// Mode
// ---------------------------------------------------------------------------

let warnedMockInProd = false

/**
 * Mock mode is on only when MOCK_INTENTS=true. In production it additionally needs
 * MOCK_INTENTS_ALLOW_PRODUCTION=true, so a stray flag can never fake payments on a live site.
 */
export function isMockMode(): boolean {
  const env = serverEnv()
  if (!env.mockIntents) return false
  if (process.env.NODE_ENV === 'production' && process.env.MOCK_INTENTS_ALLOW_PRODUCTION !== 'true') {
    if (!warnedMockInProd) {
      warnedMockInProd = true
      console.error(
        '[intents] MOCK_INTENTS=true was ignored because NODE_ENV=production. ' +
        'Set MOCK_INTENTS_ALLOW_PRODUCTION=true as well if you really want a mock demo deployment.'
      )
    }
    return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOKENS_TTL_MS = 10 * 60 * 1000
const SLIPPAGE_BPS = 100 // 1%

/** Chains whose deposits must use depositMode MEMO. Confirmed for stellar via the live API. */
const MEMO_CHAINS = new Set(['stellar'])

/** Slow-finality chains get a longer deadline request so deposits can confirm. */
const SLOW_CHAINS = new Set(['btc', 'ltc', 'doge', 'bch', 'zec', 'dash', 'cardano'])

/**
 * Dry previews happen before the fan has entered a refund address. 1Click validates refundTo
 * against refundType, so previews use an Intents account placeholder. A dry quote creates no
 * deposit address, so this account can never receive anything.
 */
const PREVIEW_REFUND_ACCOUNT = 'refund-preview.near'

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

function normalizeToken(t: TokenResponse): TokenInfo {
  return {
    assetId: t.assetId,
    symbol: t.symbol,
    chain: String(t.blockchain),
    decimals: Number(t.decimals),
    priceUsd: toNum(t.price) ?? 0,
    contractAddress: str(t.contractAddress)
  }
}

export function mapOneClickStatus(raw: OneClickStatus): TipStatus {
  switch (raw) {
    case 'PENDING_DEPOSIT':
    case 'INCOMPLETE_DEPOSIT': // deposit below the quoted amount: still waiting, refunded at deadline if not topped up
      return 'pending'
    case 'KNOWN_DEPOSIT_TX':
    case 'PROCESSING':
      return 'processing'
    case 'SUCCESS':
      return 'success'
    case 'REFUNDED':
      return 'refunded'
    case 'FAILED':
      return 'failed'
  }
}

function deadlineFor(chain: string): string {
  const minutes = SLOW_CHAINS.has(chain) ? 120 : 30
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

/**
 * Make 1Click's 400 messages readable for fans.
 * "Amount is too low for bridge, try at least 100000000000" is in base units, so convert it.
 * Some rejections (e.g. a recipient address in the wrong format) come back as a bare
 * "Internal server error" with HTTP 400, so replace that with something actionable.
 */
function humanizeQuoteError(msg: string, token?: TokenInfo): string {
  const min = /try at least (\d+)/i.exec(msg)
  if (min && token) {
    return `Amount is too low for this route. Try at least ${fromBaseUnits(min[1] as string, token.decimals)} ${token.symbol}.`
  }
  if (/^internal server error$/i.test(msg.trim())) {
    return 'The swap provider rejected this tip. Check the amount and try another token.'
  }
  if (/refundTo is not valid/i.test(msg)) {
    return 'That refund address does not look valid for the chain you are paying from.'
  }
  return msg
}

/** Turn SDK/HTTP errors into clean H3 errors with a human message. */
function toHttpError(err: unknown, token?: TokenInfo): Error {
  if (err instanceof ApiError) {
    const body = err.body as { message?: unknown } | undefined
    const msg = typeof body?.message === 'string' ? body.message : err.message
    if (err.status === 400) {
      return createError({ statusCode: 400, statusMessage: 'Quote rejected', data: { error: humanizeQuoteError(msg, token) } })
    }
    if (err.status === 401 || err.status === 403) {
      console.error('[intents] 1Click rejected our credentials. Check ONE_CLICK_JWT.')
      return createError({ statusCode: 502, statusMessage: 'Swap provider auth failed', data: { error: 'Swap provider is unavailable right now.' } })
    }
    console.error(`[intents] 1Click error ${err.status}: ${msg}`)
    return createError({ statusCode: 502, statusMessage: 'Swap provider error', data: { error: 'Swap provider is unavailable right now. Try again in a moment.' } })
  }
  console.error('[intents] unexpected error', err)
  return createError({ statusCode: 502, statusMessage: 'Swap provider error', data: { error: 'Swap provider is unavailable right now. Try again in a moment.' } })
}

function txLinks(list: SwapDetails['originChainTxHashes'] | null | undefined): TxLink[] {
  return (list ?? []).map((t) => ({ hash: t.hash, explorerUrl: t.explorerUrl }))
}

function normalizeStatus(r: GetExecutionStatusResponse): StatusResult {
  const raw = String(r.status) as OneClickStatus
  // swapDetails fields are typed as strings but the live API returns null for unset values.
  const d = (r.swapDetails ?? {}) as Partial<Record<keyof SwapDetails, unknown>> & SwapDetails
  return {
    rawStatus: raw,
    status: mapOneClickStatus(raw),
    updatedAt: r.updatedAt,
    amountOut: str(d.amountOut),
    amountOutFormatted: str(d.amountOutFormatted),
    amountOutUsd: toNum(str(d.amountOutUsd)),
    depositedAmountFormatted: str(d.depositedAmountFormatted),
    refundedAmountFormatted: str(d.refundedAmountFormatted),
    refundReason: str(d.refundReason),
    originTxs: txLinks(d.originChainTxHashes),
    destinationTxs: txLinks(d.destinationChainTxHashes)
  }
}

function normalizeQuote(r: QuoteResponse): QuoteResult {
  const q = r.quote
  return {
    depositAddress: str(q.depositAddress),
    depositMemo: str(q.depositMemo),
    amountIn: q.amountIn,
    amountInFormatted: q.amountInFormatted,
    amountInUsd: toNum(q.amountInUsd),
    amountOut: q.amountOut,
    amountOutFormatted: q.amountOutFormatted,
    amountOutUsd: toNum(q.amountOutUsd),
    minAmountOut: q.minAmountOut,
    deadline: str(q.deadline),
    timeEstimateSec: Number(q.timeEstimate) || 0,
    signature: str(r.signature),
    correlationId: str(r.correlationId)
  }
}

// ---------------------------------------------------------------------------
// Real implementation (SDK)
// ---------------------------------------------------------------------------

let sdkConfigured = false
function configureSdk(): void {
  if (sdkConfigured) return
  const env = serverEnv()
  OpenAPI.BASE = env.oneClickApiBase
  OpenAPI.TOKEN = env.oneClickJwt || undefined
  if (!env.oneClickJwt) {
    console.warn('[intents] ONE_CLICK_JWT is not set. Quotes work but carry the extra 0.25% unauthenticated fee.')
  }
  sdkConfigured = true
}

async function realGetTokens(): Promise<TokenInfo[]> {
  configureSdk()
  try {
    const list = await OneClickService.getTokens()
    return list.map(normalizeToken)
  } catch (err) {
    throw toHttpError(err)
  }
}

async function realQuote(input: QuoteInput): Promise<QuoteResult> {
  configureSdk()
  const chain = input.originToken.chain
  const useIntentsRefund = input.dry || !input.refundTo
  if (!input.dry && !input.refundTo) {
    throw createError({ statusCode: 400, statusMessage: 'Missing refund address', data: { error: 'A refund address is required.' } })
  }

  const build = (mode: QuoteRequest.depositMode): QuoteRequest => ({
    dry: input.dry,
    depositMode: mode,
    swapType: QuoteRequest.swapType.EXACT_INPUT,
    slippageTolerance: SLIPPAGE_BPS,
    originAsset: input.originToken.assetId,
    depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
    destinationAsset: input.destAssetId,
    amount: input.amountBase,
    refundTo: useIntentsRefund ? PREVIEW_REFUND_ACCOUNT : (input.refundTo as string),
    refundType: useIntentsRefund ? QuoteRequest.refundType.INTENTS : QuoteRequest.refundType.ORIGIN_CHAIN,
    recipient: input.recipient,
    recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
    deadline: deadlineFor(chain),
    referral: 'chetapawa'
  })

  const firstMode = MEMO_CHAINS.has(chain) ? QuoteRequest.depositMode.MEMO : QuoteRequest.depositMode.SIMPLE
  try {
    return normalizeQuote(await OneClickService.getQuote(build(firstMode)))
  } catch (err) {
    // A chain we did not know needs the other deposit mode: retry once with it.
    const msg = err instanceof ApiError ? String((err.body as { message?: unknown } | undefined)?.message ?? '') : ''
    if (err instanceof ApiError && err.status === 400 && /depositMode/i.test(msg)) {
      const other = firstMode === QuoteRequest.depositMode.MEMO ? QuoteRequest.depositMode.SIMPLE : QuoteRequest.depositMode.MEMO
      try {
        return normalizeQuote(await OneClickService.getQuote(build(other)))
      } catch (err2) {
        throw toHttpError(err2, input.originToken)
      }
    }
    throw toHttpError(err, input.originToken)
  }
}

async function realStatus(depositAddress: string, depositMemo?: string | null): Promise<StatusResult | null> {
  configureSdk()
  try {
    return normalizeStatus(await OneClickService.getExecutionStatus(depositAddress, depositMemo ?? undefined))
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw toHttpError(err)
  }
}

async function realSubmitDeposit(input: SubmitDepositInput): Promise<StatusResult> {
  configureSdk()
  try {
    return normalizeStatus(await OneClickService.submitDepositTx({
      txHash: input.txHash,
      depositAddress: input.depositAddress,
      memo: input.memo,
      nearSenderAccount: input.nearSenderAccount
    }))
  } catch (err) {
    throw toHttpError(err)
  }
}

// ---------------------------------------------------------------------------
// Mock implementation (MOCK_INTENTS=true)
// Fake tokens, quotes and deposit addresses. Status moves
// PENDING_DEPOSIT -> KNOWN_DEPOSIT_TX -> PROCESSING -> SUCCESS over about 20 seconds.
// Tip amounts ending in "13" (e.g. 0.13, 2.13) end as REFUNDED, to test failure UI.
// ---------------------------------------------------------------------------

const MOCK_TOKENS: TokenInfo[] = [
  { assetId: 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1', symbol: 'USDC', chain: 'near', decimals: 6, priceUsd: 1, contractAddress: '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1' },
  { assetId: 'nep141:usdt.tether-token.near', symbol: 'USDT', chain: 'near', decimals: 6, priceUsd: 1, contractAddress: 'usdt.tether-token.near' },
  { assetId: 'nep141:wrap.near', symbol: 'wNEAR', chain: 'near', decimals: 24, priceUsd: 3.9, contractAddress: 'wrap.near' },
  { assetId: 'nep141:eth.omft.near', symbol: 'ETH', chain: 'eth', decimals: 18, priceUsd: 3600, contractAddress: null },
  { assetId: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near', symbol: 'USDC', chain: 'eth', decimals: 6, priceUsd: 1, contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
  { assetId: 'nep141:base.omft.near', symbol: 'ETH', chain: 'base', decimals: 18, priceUsd: 3600, contractAddress: null },
  { assetId: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near', symbol: 'USDC', chain: 'base', decimals: 6, priceUsd: 1, contractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' },
  { assetId: 'nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near', symbol: 'USDC', chain: 'arb', decimals: 6, priceUsd: 1, contractAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831' },
  { assetId: 'nep141:sol.omft.near', symbol: 'SOL', chain: 'sol', decimals: 9, priceUsd: 93, contractAddress: null },
  { assetId: 'nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near', symbol: 'USDC', chain: 'sol', decimals: 6, priceUsd: 1, contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  { assetId: 'nep141:btc.omft.near', symbol: 'BTC', chain: 'btc', decimals: 8, priceUsd: 77000, contractAddress: null },
  { assetId: 'nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near', symbol: 'USDT', chain: 'tron', decimals: 6, priceUsd: 1, contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' },
  { assetId: 'nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz', symbol: 'XLM', chain: 'stellar', decimals: 7, priceUsd: 0.165, contractAddress: null }
]

const MOCK_MIN_USD = 0.1
const MOCK_PENDING_MS = 6_000
const MOCK_KNOWN_MS = 10_000
const MOCK_SUCCESS_MS = 20_000

interface MockQuoteRecord {
  createdAt: number
  refund: boolean
  amountOut: string
  amountOutFormatted: string
  amountOutUsd: number
  amountInFormatted: string
}

const mockQuotes = new Map<string, MockQuoteRecord>()

function randHex(n: number): string {
  const bytes = new Uint8Array(Math.ceil(n / 2))
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, n)
}

/** Mock deposit addresses embed their creation time, so status still advances after a server restart. */
function mockDepositAddress(chain: string): string {
  return `mock_${chain}_${Date.now().toString(36)}_${randHex(10)}`
}

function mockCreatedAt(depositAddress: string): number | null {
  const parts = depositAddress.split('_')
  if (parts[0] !== 'mock' || parts.length !== 4) return null
  const t = parseInt(parts[2] as string, 36)
  return Number.isFinite(t) ? t : null
}

async function mockGetTokens(): Promise<TokenInfo[]> {
  return MOCK_TOKENS.map((t) => ({ ...t }))
}

async function mockQuote(input: QuoteInput): Promise<QuoteResult> {
  const dest = MOCK_TOKENS.find((t) => t.assetId === input.destAssetId)
  if (!dest) {
    throw createError({ statusCode: 400, statusMessage: 'Quote rejected', data: { error: 'Unsupported destination asset (mock).' } })
  }
  if (!input.dry && !input.refundTo) {
    throw createError({ statusCode: 400, statusMessage: 'Missing refund address', data: { error: 'A refund address is required.' } })
  }
  const origin = input.originToken
  const inHuman = Number(fromBaseUnits(input.amountBase, origin.decimals))
  const inUsd = inHuman * origin.priceUsd
  if (inUsd < MOCK_MIN_USD) {
    const p = Math.min(origin.decimals, 8)
    const minHuman = (Math.ceil((MOCK_MIN_USD / origin.priceUsd) * 10 ** p) / 10 ** p).toFixed(p)
    const raw = `Amount is too low for bridge, try at least ${toBaseUnits(minHuman, origin.decimals)}`
    throw createError({ statusCode: 400, statusMessage: 'Quote rejected', data: { error: humanizeQuoteError(raw, origin) } })
  }
  const outUsd = inUsd * 0.993 // pretend fees
  const outHuman = outUsd / dest.priceUsd
  const outFormatted = outHuman.toFixed(Math.min(dest.decimals, 6)).replace(/\.?0+$/, '')
  const outBase = (BigInt(Math.floor(outHuman * 1e6)) * 10n ** BigInt(Math.max(dest.decimals - 6, 0)) /
    10n ** BigInt(Math.max(6 - dest.decimals, 0))).toString()
  const minOutBase = (BigInt(outBase) * 99n / 100n).toString()
  const inFormatted = fromBaseUnits(input.amountBase, origin.decimals)

  let depositAddress: string | null = null
  let depositMemo: string | null = null
  let deadline: string | null = null
  if (!input.dry) {
    depositAddress = mockDepositAddress(origin.chain)
    depositMemo = MEMO_CHAINS.has(origin.chain) ? String(1_000_000 + Math.floor(Math.random() * 9_000_000)) : null
    deadline = new Date(Date.now() + 30 * 60_000).toISOString()
    mockQuotes.set(depositAddress, {
      createdAt: Date.now(),
      refund: inFormatted.endsWith('13'),
      amountOut: outBase,
      amountOutFormatted: outFormatted,
      amountOutUsd: Number(outUsd.toFixed(6)),
      amountInFormatted: inFormatted
    })
  }

  return {
    depositAddress,
    depositMemo,
    amountIn: input.amountBase,
    amountInFormatted: inFormatted,
    amountInUsd: Number(inUsd.toFixed(6)),
    amountOut: outBase,
    amountOutFormatted: outFormatted,
    amountOutUsd: Number(outUsd.toFixed(6)),
    minAmountOut: minOutBase,
    deadline,
    timeEstimateSec: 20,
    signature: input.dry ? null : `mock-signature-${randHex(16)}`,
    correlationId: `mock-${randHex(12)}`
  }
}

async function mockStatus(depositAddress: string): Promise<StatusResult | null> {
  const createdAt = mockCreatedAt(depositAddress)
  if (createdAt === null) return null
  const rec = mockQuotes.get(depositAddress)
  const age = Date.now() - createdAt

  let raw: OneClickStatus
  if (age < MOCK_PENDING_MS) raw = 'PENDING_DEPOSIT'
  else if (age < MOCK_KNOWN_MS) raw = 'KNOWN_DEPOSIT_TX'
  else if (age < MOCK_SUCCESS_MS) raw = 'PROCESSING'
  else raw = rec?.refund ? 'REFUNDED' : 'SUCCESS'

  const done = raw === 'SUCCESS'
  const fakeTx = (label: string): TxLink => ({ hash: `mock-${label}-${depositAddress.slice(-10)}`, explorerUrl: '' })
  return {
    rawStatus: raw,
    status: mapOneClickStatus(raw),
    updatedAt: new Date().toISOString(),
    amountOut: done ? rec?.amountOut ?? null : null,
    amountOutFormatted: done ? rec?.amountOutFormatted ?? null : null,
    amountOutUsd: done ? rec?.amountOutUsd ?? null : null,
    depositedAmountFormatted: age >= MOCK_PENDING_MS ? rec?.amountInFormatted ?? null : null,
    refundedAmountFormatted: raw === 'REFUNDED' ? rec?.amountInFormatted ?? null : null,
    refundReason: raw === 'REFUNDED' ? 'MOCK_REFUND' : null,
    originTxs: age >= MOCK_PENDING_MS ? [fakeTx('origin')] : [],
    destinationTxs: done ? [fakeTx('dest')] : []
  }
}

async function mockSubmitDeposit(input: SubmitDepositInput): Promise<StatusResult> {
  const s = await mockStatus(input.depositAddress)
  if (!s) {
    throw createError({ statusCode: 404, statusMessage: 'Not found', data: { error: 'Deposit address not found.' } })
  }
  return s
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let tokenCache: { at: number; mock: boolean; tokens: TokenInfo[] } | null = null
let tokenInflight: Promise<TokenInfo[]> | null = null

/** Supported tokens, cached in memory for 10 minutes. */
export async function getTokens(): Promise<TokenInfo[]> {
  const mock = isMockMode()
  if (tokenCache && tokenCache.mock === mock && Date.now() - tokenCache.at < TOKENS_TTL_MS) {
    return tokenCache.tokens
  }
  if (!tokenInflight) {
    tokenInflight = (mock ? mockGetTokens() : realGetTokens())
      .then((tokens) => {
        const sorted = [...tokens].sort((a, b) => a.chain.localeCompare(b.chain) || a.symbol.localeCompare(b.symbol))
        tokenCache = { at: Date.now(), mock, tokens: sorted }
        return sorted
      })
      .finally(() => { tokenInflight = null })
  }
  try {
    return await tokenInflight
  } catch (err) {
    // Serve stale data rather than failing if we have any.
    if (tokenCache && tokenCache.mock === mock) return tokenCache.tokens
    throw err
  }
}

export async function findToken(assetId: string): Promise<TokenInfo | undefined> {
  return (await getTokens()).find((t) => t.assetId === assetId)
}

export function requestQuote(input: QuoteInput): Promise<QuoteResult> {
  return isMockMode() ? mockQuote(input) : realQuote(input)
}

/** Returns null when 1Click does not know the deposit address (HTTP 404). */
export function getSwapStatus(depositAddress: string, depositMemo?: string | null): Promise<StatusResult | null> {
  return isMockMode() ? mockStatus(depositAddress) : realStatus(depositAddress, depositMemo)
}

export function submitDeposit(input: SubmitDepositInput): Promise<StatusResult> {
  return isMockMode() ? mockSubmitDeposit(input) : realSubmitDeposit(input)
}
