import * as Sentry from '@sentry/react-native'
import type React from 'react'

import { buildInfo } from './build-info'

export type ObservabilityUser = {
  id?: string
  username?: string
}

export type BreadcrumbData = {
  category?: string
  message: string
  data?: Record<string, unknown>
  level?: 'info' | 'warning' | 'error'
}

const SENSITIVE_KEY_PATTERNS = [/pin/i, /password/i, /secret/i, /token/i, /auth/i]

/**
 * Sanitiza recursivamente objetos eliminando cualquier clave potencialmente sensible (PINs, contraseñas, secretos).
 */
export function sanitizeData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data
  }
  if (typeof data !== 'object') {
    return data
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item)) as unknown as T
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
    if (isSensitive) {
      sanitized[key] = '[FILTERED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized as T
}

let isInitialized = false

/**
 * Inicializa Sentry si existe un DSN configurado y no estamos en entorno de testing.
 */
export function initObservability(dsn = process.env.EXPO_PUBLIC_SENTRY_DSN): boolean {
  if (!dsn || process.env.NODE_ENV === 'test') {
    return false
  }

  if (isInitialized) {
    return true
  }

  const info = buildInfo()

  Sentry.init({
    dsn,
    release: info.version,
    dist: info.updateId ?? undefined,
    tracesSampleRate: 0.2,
    attachStacktrace: true,
    beforeSend(event) {
      if (event.extra) {
        event.extra = sanitizeData(event.extra)
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => ({
          ...b,
          data: b.data ? sanitizeData(b.data) : undefined,
        }))
      }
      return event
    },
  })

  isInitialized = true
  return true
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  const sanitizedContext = context ? sanitizeData(context) : undefined
  Sentry.captureException(error, sanitizedContext ? { extra: sanitizedContext } : undefined)
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  Sentry.captureMessage(message, level)
}

export function addBreadcrumb(breadcrumb: BreadcrumbData): void {
  Sentry.addBreadcrumb({
    category: breadcrumb.category ?? 'app',
    message: breadcrumb.message,
    data: breadcrumb.data ? sanitizeData(breadcrumb.data) : undefined,
    level: breadcrumb.level ?? 'info',
  })
}

export function setObservabilityUser(user: ObservabilityUser | null): void {
  if (!user) {
    Sentry.setUser(null)
    return
  }
  Sentry.setUser({
    id: user.id,
    username: user.username,
  })
}

export function setObservabilityTag(key: string, value: string): void {
  Sentry.setTag(key, value)
}

export function wrapRootLayout<P extends React.ComponentType<any>>(Component: P): P {
  return Sentry.wrap(Component) as P
}
