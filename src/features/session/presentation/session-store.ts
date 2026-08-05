import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { Session } from '../domain/session'
import type { SessionErrorReason } from '../domain/session-error'

type SessionStatus = 'idle' | 'loading' | 'ready' | 'error'

type SessionState = {
  status: SessionStatus
  session: Session | null
  error: SessionErrorReason | null
  start: () => void
  succeed: (session: Session) => void
  fail: (error: SessionErrorReason) => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      status: 'idle',
      session: null,
      error: null,
      start: () => set({ status: 'loading', error: null }),
      succeed: (session) => set({ status: 'ready', session, error: null }),
      fail: (error) => set({ status: 'error', error }),
    }),
    {
      name: 'session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ session: state.session }),
    },
  ),
)

export function useSessionHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useSessionStore.persist.hasHydrated())

  useEffect(() => {
    const unsubscribe = useSessionStore.persist.onFinishHydration(() => setHydrated(true))
    if (useSessionStore.persist.hasHydrated()) {
      setHydrated(true)
    }
    return unsubscribe
  }, [])

  return hydrated
}
