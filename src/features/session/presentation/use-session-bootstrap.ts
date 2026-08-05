import { useCallback, useEffect } from 'react'

import { OfflineError } from '../../../shared/lib/network'
import { supabaseSessionRepository } from '../data/supabase-session-repository'
import { ensureSession } from '../domain/ensure-session'
import { useSessionHydrated, useSessionStore } from './session-store'

export function useSessionBootstrap() {
  const status = useSessionStore((state) => state.status)
  const error = useSessionStore((state) => state.error)
  const start = useSessionStore((state) => state.start)
  const succeed = useSessionStore((state) => state.succeed)
  const fail = useSessionStore((state) => state.fail)
  const hydrated = useSessionHydrated()

  const run = useCallback(async () => {
    start()
    try {
      succeed(await ensureSession(supabaseSessionRepository))
    } catch (cause) {
      const known = useSessionStore.getState().session
      if (cause instanceof OfflineError && known) {
        succeed(known)
        return
      }
      fail(cause instanceof Error ? cause.message : String(cause))
    }
  }, [start, succeed, fail])

  useEffect(() => {
    if (hydrated && useSessionStore.getState().status === 'idle') {
      run()
    }
  }, [hydrated, run])

  return { status, error, retry: run }
}
