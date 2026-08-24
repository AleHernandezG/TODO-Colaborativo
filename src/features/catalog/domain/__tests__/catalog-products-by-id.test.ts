import type { CatalogProduct } from '../catalog-product'
import { catalogProductsById } from '../catalog-products-by-id'
import type { CatalogRepository } from '../catalog-repository'

function product(id: string, name: string): CatalogProduct {
  return {
    id,
    supermarketId: 'mercadona',
    name,
    normalizedName: name.toLowerCase(),
    brand: null,
    packageSize: null,
    imageUrl: `https://cdn.example/${id}.jpg`,
    priceCents: 100,
    currency: 'EUR',
    priceCheckedAt: '2026-08-15T00:00:00Z',
  }
}

function repositoryReturning(products: CatalogProduct[]) {
  const byIds = jest.fn((_ids: readonly string[]) => Promise.resolve(products))
  const repository: CatalogRepository = { search: () => Promise.resolve([]), byIds }
  return { repository, byIds }
}

describe('catalogProductsById', () => {
  it('devuelve un índice por id', async () => {
    const leche = product('prod-1', 'Leche entera')
    const pan = product('prod-2', 'Pan de molde')
    const { repository } = repositoryReturning([leche, pan])

    await expect(catalogProductsById(repository, ['prod-1', 'prod-2'])).resolves.toEqual({
      'prod-1': leche,
      'prod-2': pan,
    })
  })

  it('sin ids no pregunta al repositorio', async () => {
    const { repository, byIds } = repositoryReturning([])

    await expect(catalogProductsById(repository, [])).resolves.toEqual({})
    expect(byIds).not.toHaveBeenCalled()
  })

  it('un id que ya no está en el catálogo simplemente no aparece', async () => {
    const { repository } = repositoryReturning([product('prod-1', 'Leche entera')])

    const index = await catalogProductsById(repository, ['prod-1', 'prod-borrado'])

    expect(index['prod-borrado']).toBeUndefined()
    expect(Object.keys(index)).toEqual(['prod-1'])
  })
})
