import AsyncStorage from '@react-native-async-storage/async-storage'
import { renderHook, waitFor } from '@testing-library/react-native'

import { OfflineError } from '@/shared/lib/network'

import { supabaseSessionRepository } from '../../../data/supabase-session-repository'
import { useSessionStore } from '../../stores/session-store'
import { useSessionBootstrap } from '../use-session-bootstrap'

jest.mock('../../../data/supabase-session-repository', () => ({
  supabaseSessionRepository: {
    getCurrent: jest.fn(),
    signInAnonymously: jest.fn(),
  },
}))

describe('useSessionBootstrap — Benchmark de arranque e inicialización de sesión', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await AsyncStorage.clear()
    useSessionStore.setState({
      status: 'idle',
      session: null,
      error: null,
    })
  })

  it('arranque Online con sesión existente: alcanza estado "ready" en < 500 ms', async () => {
    ;(supabaseSessionRepository.getCurrent as jest.Mock).mockResolvedValue({
      userId: 'user-existing-123',
    })

    const start = performance.now()
    const { result } = await renderHook(() => useSessionBootstrap())

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    const duration = performance.now() - start

    expect(useSessionStore.getState().session).toEqual({ userId: 'user-existing-123' })
    expect(result.current.error).toBeNull()
    expect(duration).toBeLessThan(500)
  })

  it('arranque Online por primera vez (anónimo): completa bootstrap en < 500 ms', async () => {
    ;(supabaseSessionRepository.getCurrent as jest.Mock).mockResolvedValue(null)
    ;(supabaseSessionRepository.signInAnonymously as jest.Mock).mockResolvedValue({
      userId: 'anon-user-456',
    })

    const start = performance.now()
    const { result } = await renderHook(() => useSessionBootstrap())

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    const duration = performance.now() - start

    expect(useSessionStore.getState().session).toEqual({ userId: 'anon-user-456' })
    expect(result.current.error).toBeNull()
    expect(duration).toBeLessThan(500)
  })

  it('arranque Offline con sesión cacheada: restaura sesión de inmediato (< 100 ms)', async () => {
    useSessionStore.setState({
      status: 'idle',
      session: { userId: 'cached-user-789' },
      error: null,
    })
    ;(supabaseSessionRepository.getCurrent as jest.Mock).mockRejectedValue(new OfflineError())

    const start = performance.now()
    const { result } = await renderHook(() => useSessionBootstrap())

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    const duration = performance.now() - start

    expect(useSessionStore.getState().session).toEqual({ userId: 'cached-user-789' })
    expect(result.current.error).toBeNull()
    expect(duration).toBeLessThan(100)
  })

  it('arranque Offline sin sesión previa: detecta OfflineError limpiamente en < 500 ms', async () => {
    ;(supabaseSessionRepository.getCurrent as jest.Mock).mockRejectedValue(new OfflineError())

    const start = performance.now()
    const { result } = await renderHook(() => useSessionBootstrap())

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
    const duration = performance.now() - start

    expect(result.current.error).toBe('offline')
    expect(duration).toBeLessThan(500)
  })
})
