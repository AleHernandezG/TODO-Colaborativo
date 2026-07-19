import { useCallback, useEffect } from 'react'

import { supabaseSessionRepository } from '../data/supabase-session-repository'
import { ensureSession } from '../domain/ensure-session'
import { useSessionStore } from './session-store'

export function useSessionBootstrap() {
  const status = useSessionStore((state) => state.status)
  const error = useSessionStore((state) => state.error)
  const start = useSessionStore((state) => state.start)
  const succeed = useSessionStore((state) => state.succeed)
  const fail = useSessionStore((state) => state.fail)

  const run = useCallback(async () => {
    start()
    try {
      succeed(await ensureSession(supabaseSessionRepository))
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : String(cause))
    }
  }, [start, succeed, fail])

  useEffect(() => {
    if (useSessionStore.getState().status === 'idle') {
      run()
    }
  }, [run])

  return { status, error, retry: run }
}
