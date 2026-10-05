import { renderHook } from '@testing-library/react-native'

import type { Membership } from '../../../domain/community'
import { useActiveCommunityStore } from '../../stores/active-community-store'
import { createQueryClient, membership, wrapperFor } from '../__fixtures__/query-wrapper'
import { myCommunitiesKey } from '../use-my-communities'
import { useOpenCommunity } from '../use-open-community'

jest.mock('../../../data/supabase-community-repository', () => ({
  supabaseCommunityRepository: { listMine: jest.fn() },
}))

const casa = membership('c1', 'Casa')
const piso = membership('c2', 'Piso')

async function setup(cached: Membership[] | undefined) {
  const client = createQueryClient()
  if (cached) {
    client.setQueryData<Membership[]>(myCommunitiesKey, cached)
  }
  const { result } = await renderHook(() => useOpenCommunity(), { wrapper: wrapperFor(client) })
  return result.current
}

describe('useOpenCommunity', () => {
  beforeEach(() => {
    useActiveCommunityStore.setState({ membership: casa })
  })

  it('no toca nada si la lista pedida ya es la activa', async () => {
    const open = await setup(undefined)

    expect(open('c1')).toBe(true)
    expect(useActiveCommunityStore.getState().membership).toBe(casa)
  })

  it('cambia a otra de mis listas', async () => {
    const open = await setup([casa, piso])

    expect(open('c2')).toBe(true)
    expect(useActiveCommunityStore.getState().membership).toEqual(piso)
  })

  it('se niega si no estoy en esa lista y deja la activa como estaba', async () => {
    const open = await setup([casa, piso])

    expect(open('c9')).toBe(false)
    expect(useActiveCommunityStore.getState().membership).toBe(casa)
  })

  it('se niega si mis listas aún no están cargadas', async () => {
    const open = await setup(undefined)

    expect(open('c2')).toBe(false)
  })
})
