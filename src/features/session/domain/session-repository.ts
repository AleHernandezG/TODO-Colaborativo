import type { Session } from './session'

export interface SessionRepository {
  getCurrent(): Promise<Session | null>
  signInAnonymously(): Promise<Session>
}
