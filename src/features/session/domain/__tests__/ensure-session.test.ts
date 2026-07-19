import { ensureSession } from '../ensure-session'
import type { SessionRepository } from '../session-repository'

function fakeRepository(overrides: Partial<SessionRepository> = {}): SessionRepository {
  return {
    getCurrent: async () => null,
    signInAnonymously: async () => ({ userId: 'nuevo' }),
    ...overrides,
  }
}

describe('ensureSession', () => {
  it('reutiliza la sesión guardada', async () => {
    const signInAnonymously = jest.fn()
    const session = await ensureSession(
      fakeRepository({ getCurrent: async () => ({ userId: 'guardado' }), signInAnonymously }),
    )

    expect(session).toEqual({ userId: 'guardado' })
    expect(signInAnonymously).not.toHaveBeenCalled()
  })

  it('crea una sesión anónima si no hay ninguna', async () => {
    const session = await ensureSession(fakeRepository())

    expect(session).toEqual({ userId: 'nuevo' })
  })

  it('propaga el error si no se puede crear la sesión', async () => {
    const repository = fakeRepository({
      signInAnonymously: async () => {
        throw new Error('sesiones anónimas desactivadas')
      },
    })

    await expect(ensureSession(repository)).rejects.toThrow('sesiones anónimas desactivadas')
  })
})
