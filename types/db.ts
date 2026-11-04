// Hand-written types matching supabase/schema.sql.
// Keep in sync with the schema when it changes.

export type TipStatus = 'pending' | 'processing' | 'success' | 'failed' | 'refunded' | 'expired'

export const TERMINAL_TIP_STATUSES: readonly TipStatus[] = ['success', 'failed', 'refunded', 'expired']

export type CreatorRow = {
  id: string
  handle: string
  display_name: string
  bio: string | null
  payout_address: string
  dest_asset_id: string
  dest_asset_symbol: string
  dest_chain: string
  manage_token_hash: string
  created_at: string
}

/** Creator fields that are safe to send to the browser. */
export type PublicCreator = Omit<CreatorRow, 'manage_token_hash'>

export type GoalRow = {
  id: string
  creator_id: string
  title: string
  target_amount: number
  active: boolean
  created_at: string
  completed_at: string | null
}

export type TipRow = {
  id: string
  creator_id: string
  goal_id: string | null
  origin_asset_id: string
  origin_asset_symbol: string
  origin_chain: string
  /** Base units, as sent to the quote. */
  amount_in: string
  amount_in_formatted: string | null
  /** Base units of the creator's receive asset, filled on success. */
  amount_out: string | null
  /** Quote estimate until the tip settles, then the delivered amount. */
  amount_out_formatted: string | null
  amount_out_usd: number | null
  quote_out_usd: number | null
  /** Deposit deadline returned by 1Click. */
  expires_at: string | null
  deposit_address: string
  deposit_memo: string | null
  status: TipStatus
  tipper_name: string | null
  message: string | null
  created_at: string
  settled_at: string | null
}

export type GoalProgressRow = {
  goal_id: string
  creator_id: string
  title: string
  target_amount: number
  active: boolean
  created_at: string
  completed_at: string | null
  raised_usd: number
  raised_out: number
  tip_count: number
}

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export interface Database {
  public: {
    Tables: {
      cz_creators: {
        Row: CreatorRow
        Insert: Optional<CreatorRow, 'id' | 'created_at' | 'bio'>
        Update: Partial<CreatorRow>
        Relationships: []
      }
      cz_goals: {
        Row: GoalRow
        Insert: Optional<GoalRow, 'id' | 'created_at' | 'active' | 'completed_at'>
        Update: Partial<GoalRow>
        Relationships: []
      }
      cz_tips: {
        Row: TipRow
        Insert: Optional<
          TipRow,
          | 'id' | 'created_at' | 'goal_id' | 'amount_out' | 'amount_out_usd'
          | 'deposit_memo' | 'status' | 'tipper_name' | 'message' | 'settled_at'
          | 'amount_in_formatted' | 'amount_out_formatted' | 'quote_out_usd' | 'expires_at'
        >
        Update: Partial<TipRow>
        Relationships: []
      }
    }
    Views: {
      cz_goal_progress: {
        Row: GoalProgressRow
        Relationships: []
      }
    }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
