import type { Session } from './session'
import type { SessionRepository } from './session-repository'

export async function ensureSession(repository: SessionRepository): Promise<Session> {
  const existing = await repository.getCurrent()
  if (existing) {
    return existing
  }
  return repository.signInAnonymously()
}
