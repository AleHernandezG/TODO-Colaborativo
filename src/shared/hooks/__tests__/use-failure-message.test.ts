import { renderHook } from '@testing-library/react-native'

import { ServerError } from '../../lib/errors'
import { OfflineError } from '../../lib/network'
import { useFailureMessage } from '../use-failure-message'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params ? `${params.message} (${params.code})` : key,
  }),
}))

jest.mock('../../lib/observability', () => ({ captureError: jest.fn() }))

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

async function failureMessage() {
  const { result } = await renderHook(() => useFailureMessage())
  return result.current
}

it('usa el mensaje genérico de cada tipo de fallo', async () => {
  const messageFor = await failureMessage()

  expect(messageFor(new OfflineError(), 'No se pudo')).toBe('errors.offline')
})

it('deja el mensaje de la acción cuando el servidor rechaza', async () => {
  const messageFor = await failureMessage()

  expect(messageFor(new ServerError('set_member_pin', 'denegado', '42501'), 'No se pudo')).toBe(
    'No se pudo (42501)',
  )
})

it('da a la pantalla la última palabra sobre un tipo de fallo', async () => {
  const messageFor = await failureMessage()
  const byFailure = { offline: 'Sin conexión. El PIN no ha cambiado.' }

  expect(messageFor(new OfflineError(), 'No se pudo', byFailure)).toBe(
    'Sin conexión. El PIN no ha cambiado.',
  )
  expect(
    messageFor(new ServerError('set_member_pin', 'denegado', '42501'), 'No se pudo', byFailure),
  ).toBe('No se pudo (42501)')
})

it('añade el código también al mensaje propio del tipo de fallo', async () => {
  const messageFor = await failureMessage()

  expect(
    messageFor(new ServerError('set_member_pin', 'request timed out', '504'), undefined, {
      timeout: 'No sabemos si llegó.',
    }),
  ).toBe('No sabemos si llegó. (504)')
})
