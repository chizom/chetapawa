import { z } from 'zod'

// Shared goal field rules. Targets are in USD (see README: goal math).
export const GOAL_MAX_USD = 1_000_000

export const goalTitle = z.string({ error: 'Give your goal a title.' })
  .trim()
  .min(1, 'Give your goal a title.')
  .max(80, 'Goal title can be at most 80 characters.')

export const goalTarget = z.number({ error: 'Target must be a number of US dollars.' })
  .finite('Target must be a number of US dollars.')
  .min(1, 'Target must be at least $1.')
  .max(GOAL_MAX_USD, 'Target can be at most $1,000,000.')
  .transform((n) => Math.round(n * 100) / 100)
