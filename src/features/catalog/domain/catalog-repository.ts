import type { CatalogCandidate, CatalogProduct } from './catalog-product'

export type CatalogSearchInput = {
  query: string
  supermarketId: string
  limit: number
}

export interface CatalogRepository {
  search(input: CatalogSearchInput): Promise<CatalogCandidate[]>
  byIds(ids: readonly string[]): Promise<CatalogProduct[]>
}
