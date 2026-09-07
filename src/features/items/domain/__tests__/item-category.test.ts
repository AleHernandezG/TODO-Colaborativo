import { fakeItem } from '../__fixtures__/item-repository'
import {
  getCategoryMetadata,
  groupItemsByAisle,
  inferItemCategory,
} from '../item-category'

describe('inferItemCategory', () => {
  it('infiere frutas y verduras', () => {
    expect(inferItemCategory('Manzanas')).toBe('fruits_vegetables')
    expect(inferItemCategory('plátanos de canarias')).toBe('fruits_vegetables')
    expect(inferItemCategory('Zanahoria')).toBe('fruits_vegetables')
    expect(inferItemCategory('tomates')).toBe('fruits_vegetables')
  })

  it('infiere lácteos y huevos', () => {
    expect(inferItemCategory('Leche semidesnatada')).toBe('dairy_eggs')
    expect(inferItemCategory('huevos camperos')).toBe('dairy_eggs')
    expect(inferItemCategory('yogur natural')).toBe('dairy_eggs')
    expect(inferItemCategory('queso gouda')).toBe('dairy_eggs')
  })

  it('infiere carnes y pescados', () => {
    expect(inferItemCategory('pechuga de pollo')).toBe('meat_fish')
    expect(inferItemCategory('filetes de salmón')).toBe('meat_fish')
    expect(inferItemCategory('carne picada')).toBe('meat_fish')
    expect(inferItemCategory('gamba')).toBe('meat_fish')
  })

  it('infiere panadería y cereales', () => {
    expect(inferItemCategory('pan de molde')).toBe('bakery')
    expect(inferItemCategory('galletas de chocolate')).toBe('bakery')
    expect(inferItemCategory('croissant')).toBe('bakery')
  })

  it('infiere despensa y conservas', () => {
    expect(inferItemCategory('arroz bomba')).toBe('pantry')
    expect(inferItemCategory('aceite de oliva')).toBe('pantry')
    expect(inferItemCategory('pasta espagueti')).toBe('pantry')
    expect(inferItemCategory('café molido')).toBe('pantry')
  })

  it('infiere bebidas', () => {
    expect(inferItemCategory('agua mineral')).toBe('drinks')
    expect(inferItemCategory('cerveza')).toBe('drinks')
    expect(inferItemCategory('vino tinto')).toBe('drinks')
    expect(inferItemCategory('zumo de naranja')).toBe('drinks')
  })

  it('infiere congelados', () => {
    expect(inferItemCategory('pizza congelada')).toBe('frozen')
    expect(inferItemCategory('helado de vainilla')).toBe('frozen')
  })

  it('infiere limpieza del hogar', () => {
    expect(inferItemCategory('detergente ropa')).toBe('cleaning_home')
    expect(inferItemCategory('lejía')).toBe('cleaning_home')
    expect(inferItemCategory('papel higiénico')).toBe('cleaning_home')
    expect(inferItemCategory('fregasuelos')).toBe('cleaning_home')
  })

  it('infiere cuidado e higiene personal', () => {
    expect(inferItemCategory('champú')).toBe('personal_care')
    expect(inferItemCategory('pasta de dientes')).toBe('personal_care')
    expect(inferItemCategory('gel de ducha')).toBe('personal_care')
  })

  it('devuelve "other" ante artículos desconocidos o texto vacío', () => {
    expect(inferItemCategory('cable hdmi')).toBe('other')
    expect(inferItemCategory('tornillos')).toBe('other')
    expect(inferItemCategory('')).toBe('other')
    expect(inferItemCategory('   ')).toBe('other')
  })
})

describe('getCategoryMetadata', () => {
  it('devuelve los metadatos correctos para una categoría conocida', () => {
    const meta = getCategoryMetadata('fruits_vegetables')
    expect(meta.icon).toBe('🍎')
    expect(meta.translationKey).toBe('items.categories.fruits_vegetables')
    expect(meta.order).toBe(1)
  })

  it('devuelve los metadatos de "other" si se pasa categoría desconocida', () => {
    const meta = getCategoryMetadata('non_existent' as never)
    expect(meta.id).toBe('other')
    expect(meta.icon).toBe('📦')
  })
})

describe('groupItemsByAisle', () => {
  it('agrupa los artículos en el orden estándar de pasillos', () => {
    const item1 = fakeItem({ id: '1', name: 'Leche', category: 'dairy_eggs' })
    const item2 = fakeItem({ id: '2', name: 'Manzanas', category: 'fruits_vegetables' })
    const item3 = fakeItem({ id: '3', name: 'Yogur', category: 'dairy_eggs' })
    const item4 = fakeItem({ id: '4', name: 'Pilas', category: 'other' })

    const groups = groupItemsByAisle([item1, item2, item3, item4])

    expect(groups.map((g) => g.category)).toEqual(['fruits_vegetables', 'dairy_eggs', 'other'])
    expect(groups[0].items).toEqual([item2])
    expect(groups[1].items).toEqual([item1, item3])
    expect(groups[2].items).toEqual([item4])
  })

  it('omite categorías sin artículos', () => {
    const item = fakeItem({ id: '1', name: 'Cerveza', category: 'drinks' })
    const groups = groupItemsByAisle([item])

    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('drinks')
  })

  it('clasifica como "other" los artículos sin categoría definida', () => {
    const item = fakeItem({ id: '1', name: 'Algo misterioso', category: undefined as never })
    const groups = groupItemsByAisle([item])

    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('other')
    expect(groups[0].items).toEqual([item])
  })
})
