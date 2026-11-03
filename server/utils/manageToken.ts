import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

// Creator manage tokens. The raw token is shown once at creation and never stored.
// Only its sha256 hash is kept in cz_creators.manage_token_hash.

export function generateManageToken(): string {
  return 'cgt_' + randomBytes(32).toString('base64url')
}

export function hashManageToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Constant-time comparison of a presented token against a stored hash. */
export function verifyManageToken(token: string, storedHash: string): boolean {
  if (!token || !storedHash) return false
  const a = Buffer.from(hashManageToken(token), 'hex')
  const b = Buffer.from(storedHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
