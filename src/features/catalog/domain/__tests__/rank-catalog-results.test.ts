import type { CatalogCandidate } from '../catalog-product'
import { normalizeCatalogName } from '../normalized-name'
import { rankCatalogResults } from '../rank-catalog-results'

let nextId = 0

function candidate(name: string, overrides: Partial<CatalogCandidate> = {}): CatalogCandidate {
  nextId += 1
  return {
    id: `id-${String(nextId).padStart(3, '0')}`,
    supermarketId: 'mercadona',
    name,
    normalizedName: normalizeCatalogName(name),
    brand: null,
    packageSize: null,
    imageUrl: null,
    priceCents: 100,
    currency: 'EUR',
    priceCheckedAt: '2026-08-10T01:16:21+00:00',
    similarity: 0.3,
    ...overrides,
  }
}

const names = (results: CatalogCandidate[]) => results.map((result) => result.name)

beforeEach(() => {
  nextId = 0
})

describe('rankCatalogResults', () => {
  it('devuelve nada si la búsqueda está vacía', () => {
    expect(rankCatalogResults('', [candidate('Leche entera Hacendado')], 10)).toEqual([])
  })

  it('devuelve nada si la búsqueda solo trae signos que la normalización tira', () => {
    expect(rankCatalogResults('  ¿?  ', [candidate('Leche entera Hacendado')], 10)).toEqual([])
  })

  it('devuelve nada si el límite no deja hueco', () => {
    expect(rankCatalogResults('leche', [candidate('Leche entera Hacendado')], 0)).toEqual([])
  })

  it('pone el nombre exacto por delante del que solo empieza igual', () => {
    const results = rankCatalogResults(
      'leche',
      [candidate('Leche entera Hacendado'), candidate('Leche', { similarity: 0.1 })],
      10,
    )

    expect(names(results)).toEqual(['Leche', 'Leche entera Hacendado'])
  })

  it('pone el que empieza por la búsqueda antes del que solo la contiene', () => {
    const results = rankCatalogResults(
      'leche',
      [
        candidate('Batido de chocolate 90% leche Puleva', { similarity: 0.9 }),
        candidate('Leche entera Hacendado', { similarity: 0.2 }),
      ],
      10,
    )

    expect(names(results)).toEqual([
      'Leche entera Hacendado',
      'Batido de chocolate 90% leche Puleva',
    ])
  })

  it('trata una palabra a medias como prefijo, que es lo que pasa mientras se escribe', () => {
    const results = rankCatalogResults(
      'lech',
      [candidate('Galletas de mantequilla Hacendado'), candidate('Leche entera Hacendado')],
      10,
    )

    expect(names(results)[0]).toBe('Leche entera Hacendado')
  })

  it('acepta las palabras en otro orden del que salen en el nombre', () => {
    const results = rankCatalogResults(
      'leche hacendado',
      [
        candidate('Leche entera Asturiana', { brand: 'Asturiana' }),
        candidate('Leche entera Hacendado', { brand: 'Hacendado' }),
      ],
      10,
    )

    expect(names(results)[0]).toBe('Leche entera Hacendado')
  })

  it('con todas las palabras puestas, gana el nombre que arranca por la primera', () => {
    const results = rankCatalogResults(
      'aceite oliva',
      [
        candidate('Barra pan de aceite de oliva', { similarity: 0.5 }),
        candidate('Aceite de oliva 1º Hacendado', { similarity: 0.48 }),
      ],
      10,
    )

    expect(names(results)).toEqual(['Aceite de oliva 1º Hacendado', 'Barra pan de aceite de oliva'])
  })

  it('ese escalón no altera las búsquedas de una sola palabra', () => {
    const results = rankCatalogResults(
      'leche',
      [
        candidate('Arroz con leche Hacendado', { similarity: 0.9 }),
        candidate('Leche entera Hacendado', { similarity: 0.2 }),
      ],
      10,
    )

    expect(names(results)).toEqual(['Leche entera Hacendado', 'Arroz con leche Hacendado'])
  })

  it('hunde al que no cubre todas las palabras de la búsqueda', () => {
    const results = rankCatalogResults(
      'leche entera',
      [
        candidate('Leche en polvo desnatada Hacendado', { similarity: 0.8 }),
        candidate('Leche entera Hacendado', { similarity: 0.4 }),
      ],
      10,
    )

    expect(names(results)).toEqual(['Leche entera Hacendado', 'Leche en polvo desnatada Hacendado'])
  })

  it('enseña la unidad suelta antes del pack, que es lo que se echa a la lista', () => {
    const results = rankCatalogResults(
      'leche entera',
      [
        candidate('Leche entera Hacendado', { packageSize: '6 x 1 L', priceCents: 576 }),
        candidate('Leche entera Hacendado', { packageSize: '1 L', priceCents: 96 }),
      ],
      10,
    )

    expect(results.map((result) => result.priceCents)).toEqual([96, 576])
  })

  it('deja pasar la marca aunque no esté en el nombre', () => {
    const results = rankCatalogResults(
      'bifrutas',
      [
        candidate('Zumo de piña', { brand: null, similarity: 0.5 }),
        candidate('Fruta + leche tropical', { brand: 'Bifrutas', similarity: 0.1 }),
      ],
      10,
    )

    expect(names(results)[0]).toBe('Fruta + leche tropical')
  })

  it('desempata por similitud dentro del mismo escalón', () => {
    const results = rankCatalogResults(
      'leche',
      [
        candidate('Leche desnatada Asturiana', { similarity: 0.3 }),
        candidate('Leche entera Asturiana', { similarity: 0.7 }),
      ],
      10,
    )

    expect(names(results)).toEqual(['Leche entera Asturiana', 'Leche desnatada Asturiana'])
  })

  it('con todo empatado ordena igual siempre, no como venga la lista', () => {
    const uno = candidate('Leche entera Asturiana')
    const dos = candidate('Leche entera Hacendado')

    expect(names(rankCatalogResults('leche', [uno, dos], 10))).toEqual(
      names(rankCatalogResults('leche', [dos, uno], 10)),
    )
  })

  it('ignora tildes y mayúsculas de lo que escribe el usuario', () => {
    const results = rankCatalogResults('LECHÉ Entera', [candidate('Leche entera Hacendado')], 10)

    expect(names(results)).toEqual(['Leche entera Hacendado'])
  })

  it('recorta al límite pedido', () => {
    const results = rankCatalogResults(
      'leche',
      [
        candidate('Leche entera Hacendado'),
        candidate('Leche desnatada Hacendado'),
        candidate('Leche semidesnatada Hacendado'),
      ],
      2,
    )

    expect(results).toHaveLength(2)
  })

  it('no tira los que solo pegan por trigrama, los deja al final', () => {
    const results = rankCatalogResults(
      'lehce',
      [candidate('Leche entera Hacendado', { similarity: 0.45 })],
      10,
    )

    expect(names(results)).toEqual(['Leche entera Hacendado'])
  })
})
