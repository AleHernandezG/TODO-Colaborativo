export const defaultSupermarketId = 'mercadona'
export const defaultSupermarketName = 'Mercadona'

export type CatalogProduct = {
  id: string
  supermarketId: string
  name: string
  normalizedName: string
  brand: string | null
  packageSize: string | null
  imageUrl: string | null
  priceCents: number | null
  currency: string
  priceCheckedAt: string | null
}

export type CatalogCandidate = CatalogProduct & {
  similarity: number
}
