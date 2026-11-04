// Display helpers shared by pages and components.

/** "$1.23", or "<$0.01" for tiny non-zero values. */
export function formatUsd(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return ''
  if (v > 0 && v < 0.01) return '<$0.01'
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** "12:05", "1:02:09", or "2d 4h" for long deadlines. Never negative. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (d > 0) return `${d}d ${h}h`
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * Token amount worth about `usd` dollars, rounded to 3 significant figures and
 * never more decimals than the token allows. Returns "" if there is no price.
 */
export function tokenAmountForUsd(usd: number, priceUsd: number, decimals: number): string {
  if (!(priceUsd > 0)) return ''
  const raw = usd / priceUsd
  const digits = Math.max(0, Math.min(decimals, 2 - Math.floor(Math.log10(raw))))
  const s = raw.toFixed(digits)
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}
