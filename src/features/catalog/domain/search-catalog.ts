import { type CatalogProduct, defaultSupermarketId } from './catalog-product'
import type { CatalogRepository } from './catalog-repository'
import { normalizeCatalogName } from './normalized-name'
import { rankCatalogResults } from './rank-catalog-results'

export const minQueryLength = 3
export const suggestionsLimit = 6
export const candidatesLimit = 50

export function isSearchableQuery(query: string): boolean {
  return normalizeCatalogName(query).length >= minQueryLength
}

export async function searchCatalog(
  repository: CatalogRepository,
  input: { query: string; supermarketId?: string; limit?: number },
): Promise<CatalogProduct[]> {
  if (!isSearchableQuery(input.query)) {
    return []
  }

  const candidates = await repository.search({
    query: normalizeCatalogName(input.query),
    supermarketId: input.supermarketId ?? defaultSupermarketId,
    limit: candidatesLimit,
  })

  return rankCatalogResults(input.query, candidates, input.limit ?? suggestionsLimit)
}
