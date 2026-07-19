import { supabase } from '../../../../shared/lib/supabase'
import { supabaseSessionRepository } from '../supabase-session-repository'

jest.mock('../../../../shared/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      signInAnonymously: jest.fn(),
    },
  },
}))

const auth = supabase.auth as jest.Mocked<typeof supabase.auth>

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getCurrent', () => {
  it('devuelve la sesión guardada', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'abc' } } },
      error: null,
    } as never)

    await expect(supabaseSessionRepository.getCurrent()).resolves.toEqual({ userId: 'abc' })
  })

  it('devuelve null cuando no hay sesión', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null } as never)

    await expect(supabaseSessionRepository.getCurrent()).resolves.toBeNull()
  })

  it('falla con un mensaje que dice qué pasó', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'almacenamiento corrupto' },
    } as never)

    await expect(supabaseSessionRepository.getCurrent()).rejects.toThrow('almacenamiento corrupto')
  })
})

describe('signInAnonymously', () => {
  it('devuelve el usuario creado', async () => {
    auth.signInAnonymously.mockResolvedValue({
      data: { user: { id: 'nuevo' } },
      error: null,
    } as never)

    await expect(supabaseSessionRepository.signInAnonymously()).resolves.toEqual({
      userId: 'nuevo',
    })
  })

  it('explica cómo arreglar el proveedor anónimo desactivado', async () => {
    auth.signInAnonymously.mockResolvedValue({
      data: { user: null },
      error: { code: 'anonymous_provider_disabled', message: 'Anonymous sign-ins are disabled' },
    } as never)

    await expect(supabaseSessionRepository.signInAnonymously()).rejects.toThrow(
      /Authentication > Sign In \/ Providers/,
    )
  })

  it('falla si Supabase responde sin usuario', async () => {
    auth.signInAnonymously.mockResolvedValue({ data: { user: null }, error: null } as never)

    await expect(supabaseSessionRepository.signInAnonymously()).rejects.toThrow('sin usuario')
  })
})
