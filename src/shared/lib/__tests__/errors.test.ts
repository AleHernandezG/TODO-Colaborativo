import { describeFailure, failureLabel, ServerError, serverError } from '../errors'
import { OfflineError } from '../network'

describe('serverError', () => {
  it('toma el mensaje de Supabase como detalle y el code como código', () => {
    const failure = serverError('join_community', { message: 'not a member', code: '42501' })

    expect(failure).toBeInstanceOf(ServerError)
    expect(failure.operation).toBe('join_community')
    expect(failure.detail).toBe('not a member')
    expect(failure.code).toBe('42501')
    expect(failure.message).toBe('join_community: not a member [42501]')
  })

  it('cae en details cuando no hay message', () => {
    const failure = serverError('items.insert', { message: '   ', details: 'clave duplicada' })

    expect(failure.detail).toBe('clave duplicada')
    expect(failure.code).toBeNull()
  })

  it('sin nada aprovechable deja constancia de que el servidor no explicó el fallo', () => {
    const failure = serverError('items.select', null)

    expect(failure.detail).toBe('sin detalle')
    expect(failure.message).toBe('items.select: sin detalle')
  })

  it('usa statusCode o status cuando no viene code', () => {
    expect(serverError('a', { statusCode: '409' }).code).toBe('409')
    expect(serverError('b', { statusCode: 500 }).code).toBe('500')
    expect(serverError('c', { status: 404 }).code).toBe('404')
    expect(serverError('d', { status: 0 }).code).toBeNull()
  })
})

describe('describeFailure', () => {
  it('reconoce la falta de conexión', () => {
    expect(describeFailure(new OfflineError())).toMatchObject({ kind: 'offline', code: null })
  })

  it('un error con código del servidor es un rechazo', () => {
    const failure = describeFailure(serverError('rotate_join_code', { code: 'PGRST203' }))

    expect(failure.kind).toBe('rejected')
    expect(failure.operation).toBe('rotate_join_code')
    expect(failure.code).toBe('PGRST203')
  })

  it('el fallo de red de fetch se distingue del rechazo aunque llegue como error de Supabase', () => {
    const failure = describeFailure(
      serverError('items.select', { message: 'Network request failed' }),
    )

    expect(failure.kind).toBe('unreachable')
  })

  it('el timeout gana al resto de pistas', () => {
    expect(
      describeFailure(serverError('items.select', { message: 'Request timed out', code: '504' }))
        .kind,
    ).toBe('timeout')
  })

  it('un AbortError del cliente es un timeout', () => {
    const aborted = new Error('The operation was aborted')
    aborted.name = 'AbortError'

    expect(describeFailure(aborted).kind).toBe('timeout')
  })

  it('un Error suelto sin pistas queda como desconocido y conserva su mensaje', () => {
    expect(describeFailure(new Error('boom'))).toEqual({
      kind: 'unknown',
      operation: null,
      code: null,
      detail: 'boom',
    })
  })

  it('un throw que no es Error tampoco rompe el clasificador', () => {
    expect(describeFailure('vaya')).toEqual({
      kind: 'unknown',
      operation: null,
      code: null,
      detail: 'vaya',
    })
  })
})

describe('failureLabel', () => {
  it('encadena tipo, operación y código para que el log sea buscable', () => {
    const label = failureLabel(
      describeFailure(serverError('join_community', { code: 'PGRST203', message: 'ambiguo' })),
    )

    expect(label).toBe('rejected · join_community · PGRST203: ambiguo')
  })

  it('omite las partes que no existen', () => {
    expect(failureLabel(describeFailure(new OfflineError()))).toBe(
      'offline: No hay conexión a internet.',
    )
  })
})
