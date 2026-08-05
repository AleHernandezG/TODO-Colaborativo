export type SessionErrorReason = 'offline' | 'anonymous_disabled' | 'unknown'

export class SessionError extends Error {
  readonly reason: SessionErrorReason

  constructor(reason: SessionErrorReason, detail: string) {
    super(detail)
    this.name = 'SessionError'
    this.reason = reason
  }
}
