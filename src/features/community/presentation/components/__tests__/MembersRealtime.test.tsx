import { act, cleanup, render } from '@testing-library/react-native'

import { supabaseCommunityRepository } from '../../../data/supabase-community-repository'
import { createQueryClient, membership, wrapperFor } from '../../hooks/__fixtures__/query-wrapper'
import { useCommunityMembers } from '../../hooks/use-community-members'
import { useActiveCommunityStore } from '../../stores/active-community-store'
import { MembersRealtime } from '../MembersRealtime'

jest.mock('@/shared/lib/supabase', () => {
  const { createOfflineRealtime } = jest.requireActual('@/shared/lib/__fixtures__/offline-realtime')
  return createOfflineRealtime()
})

const { realtime } = jest.requireMock('@/shared/lib/supabase') as {
  realtime: import('@supabase/supabase-js').RealtimeClient
}

function ExpensesLikeScreen({ communityId }: { communityId: string }) {
  useCommunityMembers(communityId)
  useCommunityMembers(communityId, { includeArchived: true })
  return null
}

function MembersLikeScreen({ communityId }: { communityId: string }) {
  useCommunityMembers(communityId)
  return null
}

function openTopics() {
  return realtime.getChannels().map((channel) => channel.topic)
}

describe('MembersRealtime', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(supabaseCommunityRepository, 'listMembers').mockResolvedValue([])
    useActiveCommunityStore.setState({ membership: membership('c1', 'Casa') })
  })

  afterEach(async () => {
    await cleanup()
    jest.restoreAllMocks()
    await realtime.removeAllChannels()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('Miembros encima de Gastos comparte el único canal, y cerrarla no lo toca', async () => {
    const Wrapper = wrapperFor(createQueryClient())

    const screen = await render(
      <Wrapper>
        <MembersRealtime />
        <ExpensesLikeScreen communityId="c1" />
        <MembersLikeScreen communityId="c1" />
      </Wrapper>,
    )
    expect(openTopics()).toEqual(['realtime:members:c1'])

    await screen.rerender(
      <Wrapper>
        <MembersRealtime />
        <ExpensesLikeScreen communityId="c1" />
      </Wrapper>,
    )
    expect(openTopics()).toEqual(['realtime:members:c1'])
  })

  it('cerrar y volver a abrir Gastos rápido no reabre el canal', async () => {
    const subscribe = jest.spyOn(supabaseCommunityRepository, 'subscribeMembers')
    const Wrapper = wrapperFor(createQueryClient())

    const screen = await render(
      <Wrapper>
        <MembersRealtime />
        <ExpensesLikeScreen communityId="c1" />
      </Wrapper>,
    )
    await screen.rerender(
      <Wrapper>
        <MembersRealtime />
      </Wrapper>,
    )
    await screen.rerender(
      <Wrapper>
        <MembersRealtime />
        <ExpensesLikeScreen communityId="c1" />
      </Wrapper>,
    )

    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(openTopics()).toEqual(['realtime:members:c1'])
  })

  it('cambiar de lista con Gastos abierto cierra el canal viejo y abre el nuevo', async () => {
    const Wrapper = wrapperFor(createQueryClient())

    await render(
      <Wrapper>
        <MembersRealtime />
        <ExpensesLikeScreen communityId="c1" />
      </Wrapper>,
    )

    await act(async () => {
      useActiveCommunityStore.setState({ membership: membership('c2', 'Piso') })
    })

    expect(openTopics()).toEqual(['realtime:members:c2'])
  })
})
