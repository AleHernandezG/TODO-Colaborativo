import type { CatalogCandidate } from '../catalog-product'
import type { CatalogRepository, CatalogSearchInput } from '../catalog-repository'
import { normalizeCatalogName } from '../normalized-name'
import {
  candidatesLimit,
  isSearchableQuery,
  searchCatalog,
  suggestionsLimit,
} from '../search-catalog'

let nextId = 0

function candidate(name: string, overrides: Partial<CatalogCandidate> = {}): CatalogCandidate {
  nextId += 1
  return {
    id: `product-${nextId}`,
    supermarketId: 'mercadona',
    name,
    normalizedName: normalizeCatalogName(name),
    brand: null,
    packageSize: null,
    imageUrl: null,
    priceCents: 100,
    currency: 'EUR',
    priceCheckedAt: '2026-08-15T00:00:00Z',
    similarity: 0.5,
    ...overrides,
  }
}

function repositoryReturning(candidates: CatalogCandidate[]) {
  const search = jest.fn((_input: CatalogSearchInput) => Promise.resolve(candidates))
  const repository: CatalogRepository = { search, byIds: () => Promise.resolve([]) }
  return { repository, search }
}

beforeEach(() => {
  nextId = 0
})

describe('isSearchableQuery', () => {
  it('rechaza lo que se queda corto tras normalizar', () => {
    expect(isSearchableQuery('le')).toBe(false)
    expect(isSearchableQuery('  l.  ')).toBe(false)
    expect(isSearchableQuery('')).toBe(false)
  })

  it('acepta desde tres caracteres', () => {
    expect(isSearchableQuery('pan')).toBe(true)
    expect(isSearchableQuery('  Léch  ')).toBe(true)
  })
})

describe('searchCatalog', () => {
  it('no llega a preguntar al repositorio si la consulta es corta', async () => {
    const { repository, search } = repositoryReturning([])

    await expect(searchCatalog(repository, { query: 'le' })).resolves.toEqual([])
    expect(search).not.toHaveBeenCalled()
  })

  it('pide los candidatos normalizados, del supermercado por defecto', async () => {
    const { repository, search } = repositoryReturning([])

    await searchCatalog(repository, { query: '  Léche!  ' })

    expect(search).toHaveBeenCalledWith({
      query: 'leche',
      supermarketId: 'mercadona',
      limit: candidatesLimit,
    })
  })

  it('respeta el supermercado que se le pase', async () => {
    const { repository, search } = repositoryReturning([])

    await searchCatalog(repository, { query: 'leche', supermarketId: 'otro' })

    expect(search).toHaveBeenCalledWith(expect.objectContaining({ supermarketId: 'otro' }))
  })

  it('ordena los candidatos con el ranking del dominio', async () => {
    const { repository } = repositoryReturning([
      candidate('Arroz con leche Hacendado'),
      candidate('Leche entera Hacendado'),
      candidate('Chocolate con leche Milka'),
    ])

    const results = await searchCatalog(repository, { query: 'leche' })

    expect(results.map((product) => product.name)).toEqual([
      'Leche entera Hacendado',
      'Arroz con leche Hacendado',
      'Chocolate con leche Milka',
    ])
  })

  it('corta en el número de sugerencias por defecto', async () => {
    const { repository } = repositoryReturning(
      Array.from({ length: 20 }, (_, index) => candidate(`Leche variante ${index}`)),
    )

    const results = await searchCatalog(repository, { query: 'leche' })

    expect(results).toHaveLength(suggestionsLimit)
  })

  it('acepta un límite propio', async () => {
    const { repository } = repositoryReturning([
      candidate('Leche entera Hacendado'),
      candidate('Leche desnatada Hacendado'),
    ])

    const results = await searchCatalog(repository, { query: 'leche', limit: 1 })

    expect(results).toHaveLength(1)
  })

  it('propaga el fallo del repositorio', async () => {
    const repository: CatalogRepository = {
      search: () => Promise.reject(new Error('sin red')),
      byIds: () => Promise.resolve([]),
    }

    await expect(searchCatalog(repository, { query: 'leche' })).rejects.toThrow('sin red')
  })
})
