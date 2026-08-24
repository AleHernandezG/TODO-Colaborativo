import { assertOnline } from '../../../shared/lib/network'
import { supabase } from '../../../shared/lib/supabase'
import type { CatalogCandidate, CatalogProduct } from '../domain/catalog-product'
import type { CatalogRepository } from '../domain/catalog-repository'

const columns =
  'id, supermarket_id, name, normalized_name, brand, package_size, image_url, price_cents, currency, price_checked_at'

type ProductRow = {
  id: string
  supermarket_id: string
  name: string
  normalized_name: string
  brand: string | null
  package_size: string | null
  image_url: string | null
  price_cents: number | null
  currency: string
  price_checked_at: string | null
}

type SearchRow = ProductRow & {
  similarity: number
}

function toProduct(row: ProductRow): CatalogProduct {
  return {
    id: row.id,
    supermarketId: row.supermarket_id,
    name: row.name,
    normalizedName: row.normalized_name,
    brand: row.brand,
    packageSize: row.package_size,
    imageUrl: row.image_url,
    priceCents: row.price_cents,
    currency: row.currency,
    priceCheckedAt: row.price_checked_at,
  }
}

function toCandidate(row: SearchRow): CatalogCandidate {
  return { ...toProduct(row), similarity: row.similarity }
}

export const supabaseCatalogRepository: CatalogRepository = {
  async search({ query, supermarketId, limit }) {
    await assertOnline()

    const { data, error } = await supabase.rpc('search_catalog', {
      p_query: query,
      p_supermarket_id: supermarketId,
      p_limit: limit,
    })

    if (error) {
      throw new Error(`No se pudo buscar en el catálogo: ${error.message}`)
    }

    const rows: SearchRow[] = data ?? []
    return rows.map(toCandidate)
  },

  async byIds(ids) {
    if (ids.length === 0) {
      return []
    }

    await assertOnline()

    const { data, error } = await supabase.from('catalog_products').select(columns).in('id', ids)

    if (error) {
      throw new Error(`No se pudieron cargar los productos del catálogo: ${error.message}`)
    }

    return (data ?? []).map(toProduct)
  },
}
