import { create } from 'zustand'

import type { Session } from '../domain/session'

type SessionStatus = 'idle' | 'loading' | 'ready' | 'error'

type SessionState = {
  status: SessionStatus
  session: Session | null
  error: string | null
  start: () => void
  succeed: (session: Session) => void
  fail: (error: string) => void
}

export const useSessionStore = create<SessionState>((set) => ({
  status: 'idle',
  session: null,
  error: null,
  start: () => set({ status: 'loading', error: null }),
  succeed: (session) => set({ status: 'ready', session, error: null }),
  fail: (error) => set({ status: 'error', session: null, error }),
}))
