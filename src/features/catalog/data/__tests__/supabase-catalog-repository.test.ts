import NetInfo from '@react-native-community/netinfo'

import { OfflineError } from '../../../../shared/lib/network'
import { supabase } from '../../../../shared/lib/supabase'
import { supabaseCatalogRepository } from '../supabase-catalog-repository'

jest.mock('../../../../shared/lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}))

const rpc = supabase.rpc as jest.Mock
const netInfoFetch = NetInfo.fetch as jest.Mock

const row = {
  id: '11111111-1111-1111-1111-111111111111',
  supermarket_id: 'mercadona',
  name: 'Leche entera Hacendado',
  normalized_name: 'leche entera hacendado',
  brand: 'Hacendado',
  package_size: '1 L',
  image_url: 'https://cdn.example/leche.jpg',
  price_cents: 96,
  currency: 'EUR',
  price_checked_at: '2026-08-15T00:00:00Z',
  similarity: 0.82,
}

const input = { query: 'leche', supermarketId: 'mercadona', limit: 50 }

beforeEach(() => {
  jest.clearAllMocks()
  netInfoFetch.mockResolvedValue({ isConnected: true })
})

describe('supabaseCatalogRepository.search', () => {
  it('llama a la RPC con los tres parámetros', async () => {
    rpc.mockResolvedValue({ data: [], error: null })

    await supabaseCatalogRepository.search(input)

    expect(rpc).toHaveBeenCalledWith('search_catalog', {
      p_query: 'leche',
      p_supermarket_id: 'mercadona',
      p_limit: 50,
    })
  })

  it('convierte la fila a la entidad del dominio', async () => {
    rpc.mockResolvedValue({ data: [row], error: null })

    await expect(supabaseCatalogRepository.search(input)).resolves.toEqual([
      {
        id: row.id,
        supermarketId: 'mercadona',
        name: 'Leche entera Hacendado',
        normalizedName: 'leche entera hacendado',
        brand: 'Hacendado',
        packageSize: '1 L',
        imageUrl: 'https://cdn.example/leche.jpg',
        priceCents: 96,
        currency: 'EUR',
        priceCheckedAt: '2026-08-15T00:00:00Z',
        similarity: 0.82,
      },
    ])
  })

  it('mantiene los nulos que la RPC devuelve y los tipos generados niegan', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          ...row,
          brand: null,
          package_size: null,
          image_url: null,
          price_cents: null,
          price_checked_at: null,
        },
      ],
      error: null,
    })

    const [product] = await supabaseCatalogRepository.search(input)

    expect(product).toMatchObject({
      brand: null,
      packageSize: null,
      imageUrl: null,
      priceCents: null,
      priceCheckedAt: null,
    })
  })

  it('sin filas devuelve una lista vacía', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(supabaseCatalogRepository.search(input)).resolves.toEqual([])
  })

  it('convierte el error de la RPC en un throw con su mensaje', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } })

    await expect(supabaseCatalogRepository.search(input)).rejects.toThrow(
      'No se pudo buscar en el catálogo: function does not exist',
    )
  })

  it('sin conexión no llega a llamar a la RPC', async () => {
    netInfoFetch.mockResolvedValue({ isConnected: false })

    await expect(supabaseCatalogRepository.search(input)).rejects.toBeInstanceOf(OfflineError)
    expect(rpc).not.toHaveBeenCalled()
  })
})
