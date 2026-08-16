import type { CatalogCandidate } from './catalog-product'

export type CatalogSearchInput = {
  query: string
  supermarketId: string
  limit: number
}

export interface CatalogRepository {
  search(input: CatalogSearchInput): Promise<CatalogCandidate[]>
}
