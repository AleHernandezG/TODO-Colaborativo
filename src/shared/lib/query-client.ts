import NetInfo from '@react-native-community/netinfo'
import { onlineManager, QueryClient } from '@tanstack/react-query'

import { OfflineError } from './network'
import { cacheMaxAgeMs } from './query-persister'

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
)

export const maxQueryRetries = 2

export function shouldRetryQuery(failureCount: number, error: Error): boolean {
  if (error instanceof OfflineError) {
    return false
  }
  return failureCount < maxQueryRetries
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: cacheMaxAgeMs,
      retry: shouldRetryQuery,
    },
  },
})
