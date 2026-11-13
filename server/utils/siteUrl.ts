import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/

/**
 * Base URL for links we hand back (tip page, dashboard, overlay).
 * Uses NUXT_PUBLIC_SITE_URL when set. If it is missing, or still the localhost
 * default while the request came from a real domain, falls back to the
 * request's own origin, so a deployed site never hands out localhost links.
 * The links go back only to the person who made the request.
 */
export function siteBase(event: H3Event): string {
  const configured = String(useRuntimeConfig(event).public.siteUrl || '').replace(/\/+$/, '')
  const origin = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
  if (!configured) return origin
  return LOCAL.test(configured) && !LOCAL.test(origin) ? origin : configured
}
