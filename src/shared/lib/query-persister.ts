import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { Mutation, Query } from '@tanstack/react-query'
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client'

import { buildInfo } from './build-info'

export const cacheMaxAgeMs = 7 * 24 * 60 * 60 * 1000

export function shouldPersistQuery(query: Query): boolean {
  return query.state.status === 'success' && query.meta?.persist === true
}

export function shouldPersistMutation(mutation: Mutation): boolean {
  return mutation.state.isPaused
}

export function cacheBuster(): string {
  const { version, updateId } = buildInfo()
  return `${version}-${updateId ?? 'base'}`
}

export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister: createAsyncStoragePersister({ storage: AsyncStorage, key: 'query-cache' }),
  maxAge: cacheMaxAgeMs,
  buster: cacheBuster(),
  dehydrateOptions: {
    shouldDehydrateQuery: shouldPersistQuery,
    shouldDehydrateMutation: shouldPersistMutation,
  },
}
