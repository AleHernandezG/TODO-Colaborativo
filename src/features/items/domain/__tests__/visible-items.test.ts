import type { Item } from '../item'
import { visibleItems } from '../visible-items'

function item(id: string): Item {
  return {
    id,
    name: `Artículo ${id}`,
    quantity: 1,
    isPurchased: false,
    createdAt: '2026-08-02T10:00:00.000Z',
  }
}

it('devuelve la misma lista cuando no hay borrados en curso', () => {
  const items = [item('i1'), item('i2')]

  expect(visibleItems(items, [])).toBe(items)
})

it('esconde los artículos que están dentro de su ventana de deshacer', () => {
  const items = [item('i1'), item('i2'), item('i3')]

  expect(visibleItems(items, ['i2']).map((i) => i.id)).toEqual(['i1', 'i3'])
})

it('ignora los ids que ya no están en la lista', () => {
  const items = [item('i1')]

  expect(visibleItems(items, ['i9'])).toEqual(items)
})

it('esconde varios borrados a la vez', () => {
  const items = [item('i1'), item('i2'), item('i3')]

  expect(visibleItems(items, ['i1', 'i3'])).toEqual([item('i2')])
})
