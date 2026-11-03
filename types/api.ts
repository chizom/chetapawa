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

export type { TipStatus }
