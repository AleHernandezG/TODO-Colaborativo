import { useQuery } from '@tanstack/react-query'

import { supabaseCatalogRepository } from '../../data/supabase-catalog-repository'
import { type CatalogProductsById, catalogProductsById } from '../../domain/catalog-products-by-id'

const freshForMs = 24 * 60 * 60 * 1000

export function catalogProductsKey(ids: readonly string[]) {
  return ['catalog-products', ids.join(',')] as const
}

const empty: CatalogProductsById = {}

export function useCatalogProducts(ids: readonly string[]): CatalogProductsById {
  const { data } = useQuery({
    queryKey: catalogProductsKey(ids),
    queryFn: () => catalogProductsById(supabaseCatalogRepository, ids),
    enabled: ids.length > 0,
    staleTime: freshForMs,
    gcTime: freshForMs,
    meta: { persist: true },
  })

  return data ?? empty
}
