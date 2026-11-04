import type { H3Event } from 'h3'

// Tiny in-memory fixed-window rate limiter. Per server instance only, which is
// fine for a hackathon demo. On serverless it resets on cold starts.

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
}

export function clientIp(event: H3Event): string {
  return getRequestIP(event, { xForwardedFor: true }) || 'unknown'
}

/**
 * Throws 429 when `key` has been used more than `limit` times in `windowMs`.
 * Use a key that includes the route name, e.g. `creators:${ip}`.
 */
export function rateLimit(event: H3Event, key: string, limit: number, windowMs: number): void {
  const now = Date.now()
  sweep(now)
  let b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs }
    buckets.set(key, b)
  }
  b.count++
  if (b.count > limit) {
    const retry = Math.max(1, Math.ceil((b.resetAt - now) / 1000))
    setResponseHeader(event, 'Retry-After', retry)
    throw createError({ statusCode: 429, statusMessage: 'Too many requests', data: { error: `Too many requests. Try again in ${retry} seconds.` } })
  }
}

/**
 * Throws 429 if `key` has already reached `limit` in its current window, without counting
 * this request. Pair it with rateLimit() on failure only, e.g. to lock out repeated bad tokens.
 */
export function assertUnderLimit(event: H3Event, key: string, limit: number): void {
  const now = Date.now()
  const b = buckets.get(key)
  if (b && b.resetAt > now && b.count >= limit) {
    const retry = Math.max(1, Math.ceil((b.resetAt - now) / 1000))
    setResponseHeader(event, 'Retry-After', retry)
    throw createError({ statusCode: 429, statusMessage: 'Too many requests', data: { error: `Too many failed attempts. Try again in ${retry} seconds.` } })
  }
}
