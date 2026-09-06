import { useCallback, useEffect } from 'react'

import { OfflineError } from '@/shared/lib/network'
import { captureError, setObservabilityUser } from '@/shared/lib/observability'

import { supabaseSessionRepository } from '../../data/supabase-session-repository'
import { ensureSession } from '../../domain/ensure-session'
import { SessionError, type SessionErrorReason } from '../../domain/session-error'
import { useSessionHydrated, useSessionStore } from '../stores/session-store'

function reasonOf(cause: unknown): SessionErrorReason {
  if (cause instanceof OfflineError) {
    return 'offline'
  }
  if (cause instanceof SessionError) {
    return cause.reason
  }
  return 'unknown'
}

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
      const session = await ensureSession(supabaseSessionRepository)
      succeed(session)
      setObservabilityUser({ id: session.userId })
    } catch (cause) {
      const known = useSessionStore.getState().session
      if (cause instanceof OfflineError && known) {
        succeed(known)
        setObservabilityUser({ id: known.userId })
        return
      }
      const reason = reasonOf(cause)
      if (reason !== 'offline') {
        captureError(cause, { reason })
      }
      fail(reason)
    }
  }, [start, succeed, fail])

  useEffect(() => {
    if (hydrated && useSessionStore.getState().status === 'idle') {
      run()
    }
  }, [hydrated, run])

  return { status, error, retry: run }
}
