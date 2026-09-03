import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { useDebouncedValue } from '@/shared/hooks/use-debounced-value'
import { useSyncStatus } from '@/shared/hooks/use-sync-status'

import { supabaseCatalogRepository } from '../../data/supabase-catalog-repository'
import { type CatalogProduct, defaultSupermarketId } from '../../domain/catalog-product'
import { normalizeCatalogName } from '../../domain/normalized-name'
import { isSearchableQuery, searchCatalog } from '../../domain/search-catalog'

export const typingPauseMs = 250

const freshForMs = 5 * 60 * 1000

export function catalogSearchKey(supermarketId: string, query: string) {
  return ['catalog-search', supermarketId, query] as const
}

export type CatalogProblem = 'offline' | 'unreachable'

export type CatalogSearch = {
  suggestions: CatalogProduct[]
  loading: boolean
  problem: CatalogProblem | null
}

function searchProblem(
  searching: boolean,
  online: boolean,
  failed: boolean,
): CatalogProblem | null {
  if (!searching) return null
  if (!online) return 'offline'
  return failed ? 'unreachable' : null
}

export function useCatalogSearch(typed: string): CatalogSearch {
  const { online } = useSyncStatus()
  const searching = isSearchableQuery(typed)
  const query = normalizeCatalogName(useDebouncedValue(typed, typingPauseMs))
  const settled = searching && isSearchableQuery(query)

  const { data, isFetching, isError } = useQuery({
    queryKey: catalogSearchKey(defaultSupermarketId, query),
    queryFn: () => searchCatalog(supabaseCatalogRepository, { query }),
    enabled: settled && online,
    staleTime: freshForMs,
    placeholderData: keepPreviousData,
    retry: 1,
  })

  return {
    suggestions: settled && data !== undefined ? data : [],
    loading: settled && online && data === undefined && isFetching,
    problem: searchProblem(searching, online, isError),
  }
}
