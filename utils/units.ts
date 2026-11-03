// Convert between human amounts ("1.5") and integer base units ("1500000").
// Uses BigInt so 18- and 24-decimal tokens never lose precision.
// Shared by browser and server code.

const AMOUNT_RE = /^\d+(\.\d+)?$/

export function isValidAmount(amount: string): boolean {
  return AMOUNT_RE.test(amount.trim())
}

/** "1.5" with 6 decimals -> "1500000". Throws on bad input or too many decimals. */
export function toBaseUnits(amount: string, decimals: number): string {
  const a = amount.trim()
  if (!AMOUNT_RE.test(a)) throw new Error('Amount must be a positive number like 1.5')
  const [whole = '0', frac = ''] = a.split('.')
  if (frac.length > decimals) throw new Error(`Too many decimal places. This token allows ${decimals}.`)
  const base = BigInt(whole + frac.padEnd(decimals, '0'))
  return base.toString()
}

/** "1500000" with 6 decimals -> "1.5". Trailing zeros are trimmed. */
export function fromBaseUnits(base: string, decimals: number): string {
  if (!/^\d+$/.test(base)) return '0'
  if (decimals === 0) return BigInt(base).toString()
  const s = BigInt(base).toString().padStart(decimals + 1, '0')
  const whole = s.slice(0, -decimals)
  const frac = s.slice(-decimals).replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : whole
}
