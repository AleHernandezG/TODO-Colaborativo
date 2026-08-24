import type { Item } from '../item'
import { catalogImageProductIds, itemImageSource } from '../item-image-source'

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    name: 'Leche entera Hacendado',
    quantity: 1,
    isPurchased: false,
    imagePath: null,
    catalogProductId: null,
    createdAt: '2026-08-16T10:00:00Z',
    ...overrides,
  }
}

describe('itemImageSource', () => {
  it('sin foto ni producto no hay imagen', () => {
    expect(itemImageSource(item())).toEqual({ kind: 'none' })
  })

  it('la foto propia sale del bucket', () => {
    expect(itemImageSource(item({ imagePath: 'com-1/item-1.jpg' }))).toEqual({
      kind: 'own',
      path: 'com-1/item-1.jpg',
    })
  })

  it('sin foto propia pero con producto, la imagen es la del catálogo', () => {
    expect(itemImageSource(item({ catalogProductId: 'prod-1' }))).toEqual({
      kind: 'catalog',
      productId: 'prod-1',
    })
  })

  it('la foto propia gana al catálogo, que para eso la hizo alguien', () => {
    const source = itemImageSource(
      item({ imagePath: 'com-1/item-1.jpg', catalogProductId: 'prod-1' }),
    )

    expect(source).toEqual({ kind: 'own', path: 'com-1/item-1.jpg' })
  })
})

describe('catalogImageProductIds', () => {
  it('sin artículos no pide nada', () => {
    expect(catalogImageProductIds([])).toEqual([])
  })

  it('junta solo los que van a enseñar foto del catálogo', () => {
    const items = [
      item({ id: 'a', catalogProductId: 'prod-1' }),
      item({ id: 'b' }),
      item({ id: 'c', imagePath: 'com-1/c.jpg', catalogProductId: 'prod-2' }),
      item({ id: 'd', catalogProductId: 'prod-3' }),
    ]

    expect(catalogImageProductIds(items)).toEqual(['prod-1', 'prod-3'])
  })

  it('el mismo producto en dos artículos se pide una vez', () => {
    const items = [
      item({ id: 'a', catalogProductId: 'prod-1' }),
      item({ id: 'b', catalogProductId: 'prod-1' }),
    ]

    expect(catalogImageProductIds(items)).toEqual(['prod-1'])
  })

  it('el orden no depende del de la lista, que es lo que fija la clave de la consulta', () => {
    const uno = item({ id: 'a', catalogProductId: 'prod-9' })
    const dos = item({ id: 'b', catalogProductId: 'prod-1' })

    expect(catalogImageProductIds([uno, dos])).toEqual(catalogImageProductIds([dos, uno]))
  })
})
