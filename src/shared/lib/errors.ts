import { OfflineError } from './network'

export type FailureKind = 'offline' | 'timeout' | 'unreachable' | 'rejected' | 'unknown'

export type Failure = {
  kind: FailureKind
  operation: string | null
  code: string | null
  detail: string
}

type SupabaseLikeError = {
  message?: string | null
  code?: string | null
  details?: string | null
  status?: number | null
  statusCode?: string | number | null
}

const unreachablePattern = /network request failed|failed to fetch|fetch failed|network error/i
const timeoutPattern = /abort|timeout|timed out/i

export class ServerError extends Error {
  readonly operation: string
  readonly code: string | null
  readonly detail: string

  constructor(operation: string, detail: string, code: string | null = null) {
    super(code ? `${operation}: ${detail} [${code}]` : `${operation}: ${detail}`)
    this.name = 'ServerError'
    this.operation = operation
    this.code = code
    this.detail = detail
  }
}

export function serverError(operation: string, cause: SupabaseLikeError | null | undefined) {
  const detail = cause?.message?.trim() || cause?.details?.trim() || 'sin detalle'
  const code = normalizeCode(cause)

  return new ServerError(operation, detail, code)
}

function normalizeCode(cause: SupabaseLikeError | null | undefined): string | null {
  if (!cause) {
    return null
  }
  if (typeof cause.code === 'string' && cause.code.trim() !== '') {
    return cause.code.trim()
  }
  if (typeof cause.statusCode === 'string' && cause.statusCode.trim() !== '') {
    return cause.statusCode.trim()
  }
  if (typeof cause.statusCode === 'number') {
    return String(cause.statusCode)
  }
  if (typeof cause.status === 'number' && cause.status !== 0) {
    return String(cause.status)
  }
  return null
}

function kindOf(code: string | null, detail: string): FailureKind {
  if (timeoutPattern.test(detail)) {
    return 'timeout'
  }
  if (unreachablePattern.test(detail)) {
    return 'unreachable'
  }
  return code ? 'rejected' : 'unknown'
}

export function describeFailure(cause: unknown): Failure {
  if (cause instanceof OfflineError) {
    return { kind: 'offline', operation: null, code: null, detail: cause.message }
  }

  if (cause instanceof ServerError) {
    return {
      kind: kindOf(cause.code, cause.detail),
      operation: cause.operation,
      code: cause.code,
      detail: cause.detail,
    }
  }

  if (cause instanceof Error) {
    const detail = cause.message || cause.name
    return {
      kind: cause.name === 'AbortError' ? 'timeout' : kindOf(null, detail),
      operation: null,
      code: null,
      detail,
    }
  }

  return { kind: 'unknown', operation: null, code: null, detail: String(cause) }
}

export function failureLabel(failure: Failure): string {
  const parts: string[] = [failure.kind]
  if (failure.operation) {
    parts.push(failure.operation)
  }
  if (failure.code) {
    parts.push(failure.code)
  }
  return `${parts.join(' · ')}: ${failure.detail}`
}

export function logFailure(failure: Failure): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.error(`[error] ${failureLabel(failure)}`)
  }
}
