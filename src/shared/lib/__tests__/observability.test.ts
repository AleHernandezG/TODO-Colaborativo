import * as Sentry from '@sentry/react-native'

import {
  addBreadcrumb,
  captureError,
  captureMessage,
  initObservability,
  sanitizeData,
  setObservabilityTag,
  setObservabilityUser,
  wrapRootLayout,
} from '../observability'

describe('observability / sanitizeData', () => {
  it('filtra claves sensibles en objetos planos', () => {
    const input = {
      username: 'carlos',
      pin: '1234',
      pin_hash: 'abcdef',
      token: 'secret-token',
      password: 'mypassword',
      itemsCount: 5,
    }

    const output = sanitizeData(input)

    expect(output).toEqual({
      username: 'carlos',
      pin: '[FILTERED]',
      pin_hash: '[FILTERED]',
      token: '[FILTERED]',
      password: '[FILTERED]',
      itemsCount: 5,
    })
  })

  it('filtra recursivamente claves sensibles en objetos anidados y arrays', () => {
    const input = {
      communityId: '123',
      members: [
        { name: 'Ana', pin: '4321' },
        { name: 'Luis', authSecret: 'xyz' },
      ],
      details: {
        pinCode: '9999',
        normalField: 'ok',
      },
    }

    const output = sanitizeData(input)

    expect(output).toEqual({
      communityId: '123',
      members: [
        { name: 'Ana', pin: '[FILTERED]' },
        { name: 'Luis', authSecret: '[FILTERED]' },
      ],
      details: {
        pinCode: '[FILTERED]',
        normalField: 'ok',
      },
    })
  })

  it('mantiene valores primitivos y null/undefined', () => {
    expect(sanitizeData(null)).toBeNull()
    expect(sanitizeData(undefined)).toBeUndefined()
    expect(sanitizeData(123)).toBe(123)
    expect(sanitizeData('hello')).toBe('hello')
  })
})

describe('observability / helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('no inicializa si no hay DSN', () => {
    const result = initObservability(undefined)
    expect(result).toBe(false)
    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('captura errores sanitizando el contexto adjunto', () => {
    const error = new Error('Test error')
    captureError(error, { communityId: 'comm-1', pin: '1234' })

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      extra: {
        communityId: 'comm-1',
        pin: '[FILTERED]',
      },
    })
  })

  it('captura mensajes simples', () => {
    captureMessage('Sync completed', 'info')
    expect(Sentry.captureMessage).toHaveBeenCalledWith('Sync completed', 'info')
  })

  it('añade breadcrumbs sanitizando la información', () => {
    addBreadcrumb({
      category: 'items',
      message: 'Added item',
      data: { name: 'Leche', secretKey: 'dont-leak' },
    })

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'items',
      message: 'Added item',
      data: { name: 'Leche', secretKey: '[FILTERED]' },
      level: 'info',
    })
  })

  it('configura y limpia el usuario de observabilidad sin enviar PII', () => {
    setObservabilityUser({ id: 'member-123', username: 'carlos' })
    expect(Sentry.setUser).toHaveBeenCalledWith({
      id: 'member-123',
      username: 'carlos',
    })

    setObservabilityUser(null)
    expect(Sentry.setUser).toHaveBeenCalledWith(null)
  })

  it('establece tags para contextualizar eventos', () => {
    setObservabilityTag('community_id', 'comm-xyz')
    expect(Sentry.setTag).toHaveBeenCalledWith('community_id', 'comm-xyz')
  })

  it('wrapRootLayout delega en Sentry.wrap', () => {
    const DummyComponent = () => null
    wrapRootLayout(DummyComponent)
    expect(Sentry.wrap).toHaveBeenCalledWith(DummyComponent)
  })
})
