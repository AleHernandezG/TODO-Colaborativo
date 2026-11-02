import { cleanup, render } from '@testing-library/react-native'

import { supabaseCommunityRepository } from '../../../data/supabase-community-repository'
import { createQueryClient, wrapperFor } from '../__fixtures__/query-wrapper'
import { useCommunityMembers } from '../use-community-members'

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

describe('useCommunityMembers', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(supabaseCommunityRepository, 'listMembers').mockResolvedValue([])
  })

  afterEach(async () => {
    await cleanup()
    jest.restoreAllMocks()
    await realtime.removeAllChannels()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('dos lecturas de miembros en la misma pantalla no tumban la app', async () => {
    const Wrapper = wrapperFor(createQueryClient())

    await expect(
      render(
        <Wrapper>
          <ExpensesLikeScreen communityId="c1" />
        </Wrapper>,
      ),
    ).resolves.toBeDefined()
  })

  it('leer miembros no abre ningún canal', async () => {
    const subscribe = jest.spyOn(supabaseCommunityRepository, 'subscribeMembers')
    const Wrapper = wrapperFor(createQueryClient())

    await render(
      <Wrapper>
        <ExpensesLikeScreen communityId="c1" />
        <MembersLikeScreen communityId="c1" />
      </Wrapper>,
    )

    expect(subscribe).not.toHaveBeenCalled()
    expect(realtime.getChannels()).toEqual([])
  })
})
