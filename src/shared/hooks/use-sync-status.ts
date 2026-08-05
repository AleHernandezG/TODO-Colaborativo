import { onlineManager, useMutationState } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

export type SyncStatus = {
  online: boolean
  pendingChanges: number
}

export function useSyncStatus(): SyncStatus {
  const online = useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  )

  const paused = useMutationState({
    filters: { predicate: (mutation) => mutation.state.isPaused },
  })

  return { online, pendingChanges: paused.length }
}
