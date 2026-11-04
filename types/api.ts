// Shapes returned by our own API routes. Safe for browser and server.
// These are OUR types, normalized from the 1Click API, so pages never depend
// on raw provider field names.

import type { TipStatus } from './db'

export interface TokenInfo {
  /** 1Click asset identifier, e.g. "nep141:wrap.near" */
  assetId: string
  symbol: string
  /** 1Click blockchain code, e.g. "near", "eth", "base", "sol" */
  chain: string
  decimals: number
  priceUsd: number
  contractAddress: string | null
}

export interface TokensResponse {
  tokens: TokenInfo[]
  mock: boolean
}

/** Raw 1Click execution status values, from GET /v0/status. */
export type OneClickStatus =
  | 'PENDING_DEPOSIT'
  | 'KNOWN_DEPOSIT_TX'
  | 'INCOMPLETE_DEPOSIT'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'REFUNDED'
  | 'FAILED'

export interface TxLink {
  hash: string
  explorerUrl: string
}

export interface ApiErrorBody {
  error: string
}

export interface AppConfigResponse {
  mock: boolean
}

export interface GoalWithProgress {
  id: string
  title: string
  /** Goal target in USD. */
  targetAmount: number
  /** USD value of successful tips tied to this goal. */
  raised: number
  /** 0 to 100, capped. */
  percent: number
  tipCount: number
  completed: boolean
  completedAt: string | null
  unit: 'USD'
}

export interface PublicCreatorInfo {
  handle: string
  displayName: string
  bio: string | null
  payoutAddress: string
  destAssetId: string
  destAssetSymbol: string
  destChain: string
  createdAt: string
}

export interface CreatorPublicResponse {
  creator: PublicCreatorInfo
  goal: GoalWithProgress | null
}

export interface CreateCreatorRequest {
  handle: string
  displayName: string
  bio?: string
  payoutAddress: string
  destAssetId: string
}

export interface CreateCreatorResponse {
  creator: PublicCreatorInfo
  /** Raw manage token. Returned exactly once, never stored in plain text. */
  manageToken: string
  tipUrl: string
  manageUrl: string
  overlayUrl: string
}

export interface TipPreviewRequest {
  handle: string
  originAssetId: string
  /** Human units of the origin token, e.g. "1.5". */
  amount: string
}

export interface TipPreviewResponse {
  amountIn: string
  amountInUsd: number | null
  /** Estimated amount the creator receives, human units. */
  estimatedOut: string
  estimatedOutUsd: number | null
  destSymbol: string
  destChain: string
  timeEstimateSec: number
}

export interface TipQuoteRequest extends TipPreviewRequest {
  /** Fan's own address on the origin chain. 1Click refunds here if the swap cannot complete. */
  refundAddress: string
  tipperName?: string
  message?: string
}

/** A tip as shown to the fan who sent it. Contains nothing secret. */
export interface PublicTip {
  id: string
  handle: string
  status: TipStatus
  originAssetId: string
  originSymbol: string
  originChain: string
  /** Exact amount the fan must send, human units. */
  amountIn: string
  /** Estimate until delivered, then the delivered amount. Human units. */
  amountOut: string | null
  amountOutUsd: number | null
  destSymbol: string
  destChain: string
  depositAddress: string
  depositMemo: string | null
  expiresAt: string | null
  createdAt: string
  settledAt: string | null
  tipperName: string | null
  message: string | null
}

/** Extra detail from the latest live 1Click check, when there was one. */
export interface TipLiveDetail {
  rawStatus: OneClickStatus
  refundReason: string | null
  refundedAmount: string | null
  originTxs: TxLink[]
  destinationTxs: TxLink[]
}

export interface TipResponse {
  tip: PublicTip
  live: TipLiveDetail | null
  timeEstimateSec?: number
}

export interface SubmitDepositRequest {
  txHash: string
  nearSenderAccount?: string
}

export interface CreateGoalRequest {
  handle: string
  title: string
  /** USD. */
  targetAmount: number
}

/** Edit the active goal's title or target, or end it. */
export interface UpdateGoalRequest {
  title?: string
  targetAmount?: number
  end?: boolean
}

export interface GoalResponse {
  goal: GoalWithProgress
}

export interface DashboardResponse {
  creator: PublicCreatorInfo
  goal: GoalWithProgress | null
  /** Most recent ended goals, newest first. */
  pastGoals: GoalWithProgress[]
  /** Most recent tips, newest first. */
  tips: PublicTip[]
  totals: { successCount: number; totalUsd: number }
  tipUrl: string
  overlayUrl: string
}

export type { TipStatus }
