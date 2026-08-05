import { randomUuid } from '../uuid'

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

it('devuelve un uuid v4 con el formato que espera Postgres', () => {
  expect(randomUuid()).toMatch(uuidV4)
})

it('no repite el id entre llamadas', () => {
  const ids = new Set(Array.from({ length: 100 }, randomUuid))

  expect(ids.size).toBe(100)
})
