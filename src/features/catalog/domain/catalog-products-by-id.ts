import type { CatalogProduct } from './catalog-product'
import type { CatalogRepository } from './catalog-repository'

export type CatalogProductsById = Record<string, CatalogProduct>

export async function catalogProductsById(
  repository: CatalogRepository,
  ids: readonly string[],
): Promise<CatalogProductsById> {
  if (ids.length === 0) {
    return {}
  }

  const products = await repository.byIds(ids)

  return Object.fromEntries(products.map((product) => [product.id, product]))
}
