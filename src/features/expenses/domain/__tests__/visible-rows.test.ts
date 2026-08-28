import { visibleRows } from '../visible-rows'

const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

it('sin nada en borrado devuelve la misma lista', () => {
  expect(visibleRows(rows, [])).toBe(rows)
})

it('esconde las filas marcadas sin tocar la caché', () => {
  expect(visibleRows(rows, ['b'])).toEqual([{ id: 'a' }, { id: 'c' }])
  expect(rows).toHaveLength(3)
})

it('un id que ya no está en la lista no molesta', () => {
  expect(visibleRows(rows, ['z'])).toEqual(rows)
})
