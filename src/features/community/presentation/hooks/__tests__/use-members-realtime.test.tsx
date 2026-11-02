import { act, renderHook } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'

import { supabaseCommunityRepository } from '../../../data/supabase-community-repository'
import type { MembersSubscriptionHandlers } from '../../../domain/community-repository'
import { createQueryClient, wrapperFor } from '../__fixtures__/query-wrapper'
import { communityMembersKey } from '../use-community-members'
import { useMembersRealtime } from '../use-members-realtime'

jest.mock('../../../data/supabase-community-repository', () => ({
  supabaseCommunityRepository: { subscribeMembers: jest.fn() },
}))

const subscribeMembers = supabaseCommunityRepository.subscribeMembers as jest.Mock

let events: string[]
let handlers: Map<string, MembersSubscriptionHandlers>
let appStateListener: ((next: AppStateStatus) => void) | undefined

function channelOf(communityId: string) {
  const found = handlers.get(communityId)
  if (!found) {
    throw new Error(`no hay canal abierto para ${communityId}`)
  }
  return found
}

function setup() {
  const client = createQueryClient()
  client.setQueryData(communityMembersKey('c1'), [])
  client.setQueryData(communityMembersKey('c1', true), [])
  client.setQueryData(communityMembersKey('c2'), [])
  const invalidate = jest.spyOn(client, 'invalidateQueries')
  return { client, invalidate }
}

beforeEach(() => {
  jest.useFakeTimers()
  events = []
  handlers = new Map()
  subscribeMembers.mockReset()
  subscribeMembers.mockImplementation((communityId: string, next: MembersSubscriptionHandlers) => {
    events.push(`open ${communityId}`)
    handlers.set(communityId, next)
    return () => {
      events.push(`close ${communityId}`)
      handlers.delete(communityId)
    }
  })
  appStateListener = undefined
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (next: AppStateStatus) => void
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>
  })
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('useMembersRealtime', () => {
  it('abre un solo canal para la lista activa', async () => {
    const { client } = setup()

    await renderHook(() => useMembersRealtime('c1'), { wrapper: wrapperFor(client) })

    expect(subscribeMembers).toHaveBeenCalledTimes(1)
    expect(subscribeMembers).toHaveBeenCalledWith('c1', expect.any(Object))
  })

  it('sin lista activa no abre nada', async () => {
    const { client } = setup()

    await renderHook(() => useMembersRealtime(null), { wrapper: wrapperFor(client) })

    expect(subscribeMembers).not.toHaveBeenCalled()
  })

  it('informa del estado del canal por onStatus', async () => {
    const { client } = setup()
    const { result } = await renderHook(() => useMembersRealtime('c1'), {
      wrapper: wrapperFor(client),
    })

    expect(result.current).toBe('connecting')

    await act(async () => channelOf('c1').onStatus('connected'))
    expect(result.current).toBe('connected')

    await act(async () => channelOf('c1').onStatus('disconnected'))
    expect(result.current).toBe('disconnected')
  })

  it('tras conectar vuelve a pedir los miembros cuando el servidor ya escucha', async () => {
    const { client, invalidate } = setup()
    await renderHook(() => useMembersRealtime('c1'), { wrapper: wrapperFor(client) })

    await act(async () => channelOf('c1').onStatus('connected'))
    await act(async () => jest.advanceTimersByTime(1499))
    expect(invalidate).not.toHaveBeenCalled()

    await act(async () => jest.advanceTimersByTime(1))
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['community-members', 'c1'] })
    expect(client.getQueryState(communityMembersKey('c1'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(communityMembersKey('c1', true))?.isInvalidated).toBe(true)
    expect(client.getQueryState(communityMembersKey('c2'))?.isInvalidated).toBe(false)
  })

  it('una ráfaga de cambios acaba en una sola lectura', async () => {
    const { client, invalidate } = setup()
    await renderHook(() => useMembersRealtime('c1'), { wrapper: wrapperFor(client) })

    await act(async () => {
      channelOf('c1').onChange()
      channelOf('c1').onChange()
      channelOf('c1').onChange()
      jest.advanceTimersByTime(300)
    })

    expect(invalidate).toHaveBeenCalledTimes(1)
  })

  it('con una mutación en vuelo espera a que termine', async () => {
    const { client, invalidate } = setup()
    const mutating = jest.spyOn(client, 'isMutating').mockReturnValue(1)
    await renderHook(() => useMembersRealtime('c1'), { wrapper: wrapperFor(client) })

    await act(async () => {
      channelOf('c1').onChange()
      jest.advanceTimersByTime(900)
    })
    expect(invalidate).not.toHaveBeenCalled()

    mutating.mockReturnValue(0)
    await act(async () => jest.advanceTimersByTime(300))
    expect(invalidate).toHaveBeenCalledTimes(1)
  })

  it('al volver a primer plano vuelve a pedir los miembros', async () => {
    const { client, invalidate } = setup()
    await renderHook(() => useMembersRealtime('c1'), { wrapper: wrapperFor(client) })

    await act(async () => {
      appStateListener?.('background')
      appStateListener?.('active')
      jest.advanceTimersByTime(300)
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['community-members', 'c1'] })
  })

  it('un canal caído o sin servidor no lanza nada a la pantalla', async () => {
    const { client, invalidate } = setup()
    const { result } = await renderHook(() => useMembersRealtime('c1'), {
      wrapper: wrapperFor(client),
    })

    await act(async () => {
      channelOf('c1').onStatus('disconnected')
      jest.advanceTimersByTime(5000)
    })

    expect(result.current).toBe('disconnected')
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('desmontar y volver a montar rápido cierra el canal antes de abrir el nuevo', async () => {
    const { client } = setup()
    const first = await renderHook(() => useMembersRealtime('c1'), {
      wrapper: wrapperFor(client),
    })

    await first.unmount()
    await renderHook(() => useMembersRealtime('c1'), { wrapper: wrapperFor(client) })

    expect(events).toEqual(['open c1', 'close c1', 'open c1'])
  })

  it('al cambiar de lista cierra la vieja y abre la nueva', async () => {
    const { client, invalidate } = setup()
    const { rerender, result } = await renderHook(
      ({ id }: { id: string }) => useMembersRealtime(id),
      { wrapper: wrapperFor(client), initialProps: { id: 'c1' } },
    )
    await act(async () => channelOf('c1').onStatus('connected'))

    await rerender({ id: 'c2' })

    expect(events).toEqual(['open c1', 'close c1', 'open c2'])
    expect(result.current).toBe('connecting')

    await act(async () => jest.advanceTimersByTime(1500))
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('lo que llega del canal tras desmontar se ignora', async () => {
    const { client, invalidate } = setup()
    const { unmount } = await renderHook(() => useMembersRealtime('c1'), {
      wrapper: wrapperFor(client),
    })
    const late = channelOf('c1')

    await unmount()
    await act(async () => {
      late.onStatus('connected')
      late.onChange()
      appStateListener?.('background')
      appStateListener?.('active')
      jest.advanceTimersByTime(5000)
    })

    expect(invalidate).not.toHaveBeenCalled()
  })
})
