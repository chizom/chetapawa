import type { EventHandler, EventHandlerRequest, H3Event } from 'h3'
import type { z, ZodType } from 'zod'
import type { ApiErrorBody } from '~~/types/api'

/**
 * Wraps an API route so every failure returns clean JSON: { "error": "human message" }.
 * Throw createError({ statusCode, data: { error } }) or use badRequest() for expected errors.
 * Anything unexpected becomes a generic 500 and is logged server side only.
 */
export function defineApiHandler<T>(
  handler: (event: H3Event<EventHandlerRequest>) => Promise<T> | T
): EventHandler<EventHandlerRequest, Promise<T | ApiErrorBody>> {
  return defineEventHandler(async (event) => {
    try {
      return await handler(event)
    } catch (err: unknown) {
      if (isError(err)) {
        const data = err.data as { error?: unknown } | undefined
        const message = typeof data?.error === 'string' ? data.error : err.statusMessage || 'Request failed'
        setResponseStatus(event, err.statusCode || 500)
        if ((err.statusCode || 500) >= 500) console.error(`[api] ${event.method} ${event.path}:`, message)
        return { error: message }
      }
      console.error(`[api] ${event.method} ${event.path} unexpected error:`, err)
      setResponseStatus(event, 500)
      return { error: 'Something went wrong. Please try again.' }
    }
  })
}

export function badRequest(message: string): Error {
  return createError({ statusCode: 400, statusMessage: 'Bad request', data: { error: message } })
}

export function notFound(message: string): Error {
  return createError({ statusCode: 404, statusMessage: 'Not found', data: { error: message } })
}

/** Read and validate a JSON body with zod. Throws a 400 with the first issue's message. */
export async function parseBody<S extends ZodType>(event: H3Event, schema: S): Promise<z.output<S>> {
  let raw: unknown
  try {
    raw = await readBody(event)
  } catch {
    throw badRequest('Request body must be valid JSON.')
  }
  const result = schema.safeParse(raw ?? {})
  if (!result.success) {
    // Schemas carry human messages, so return the first one as is.
    throw badRequest(result.error.issues[0]?.message ?? 'Invalid input.')
  }
  return result.data
}
