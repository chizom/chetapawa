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

export type { TipStatus }
