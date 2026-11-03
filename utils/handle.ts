// Creator handle rules. Shared by browser and server. Mirrors the DB check constraint.

export const HANDLE_RE = /^[a-z0-9_]{3,24}$/

/** Handles that would collide with app routes or look official. */
export const RESERVED_HANDLES = new Set([
  'api', 'create', 'overlay', 'manage', 'admin', 'about', 'help', 'support', 'login', 'logout',
  'signup', 'settings', 'static', 'assets', 'public', 'favicon', 'robots', 'sitemap', 'near',
  'chetapawa', 'official', 'root', 'null', 'undefined', 'tips', 'tip', 'goal', 'goals', '_nuxt'
])

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, '')
}

/** Returns null when valid, or a short human message. */
export function checkHandle(handle: string): string | null {
  if (!HANDLE_RE.test(handle)) return 'Use 3 to 24 characters: lowercase letters, numbers and underscores.'
  if (RESERVED_HANDLES.has(handle)) return 'That handle is reserved. Try another.'
  return null
}
