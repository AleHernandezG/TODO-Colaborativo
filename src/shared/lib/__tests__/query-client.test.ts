import { OfflineError } from '../network'
import { shouldRetryQuery } from '../query-client'

it('no reintenta cuando el móvil sabe que no hay red', () => {
  expect(shouldRetryQuery(0, new OfflineError())).toBe(false)
})

it('reintenta dos veces cualquier otro fallo', () => {
  const error = new Error('502')

  expect(shouldRetryQuery(0, error)).toBe(true)
  expect(shouldRetryQuery(1, error)).toBe(true)
  expect(shouldRetryQuery(2, error)).toBe(false)
})
