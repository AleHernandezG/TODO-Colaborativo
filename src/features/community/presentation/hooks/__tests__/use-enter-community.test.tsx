import { act, renderHook } from '@testing-library/react-native'

import type { Membership } from '../../../domain/community'
import { useActiveCommunityStore } from '../../stores/active-community-store'
import { createQueryClient, membership, wrapperFor } from '../__fixtures__/query-wrapper'
import { useEnterCommunity } from '../use-enter-community'
import { myCommunitiesKey } from '../use-my-communities'

jest.mock('../../../data/supabase-community-repository', () => ({
  supabaseCommunityRepository: { listMine: jest.fn() },
}))

const casa = membership('c1', 'Casa')
const piso = membership('c2', 'Piso')

describe('useEnterCommunity', () => {
  beforeEach(() => {
    useActiveCommunityStore.setState({ membership: null })
  })

  it('deja la lista nueva como activa y la añade a mis listas', async () => {
    const client = createQueryClient()
    client.setQueryData<Membership[]>(myCommunitiesKey, [casa])
    const { result } = await renderHook(() => useEnterCommunity(), { wrapper: wrapperFor(client) })

    await act(async () => {
      await result.current(piso)
    })

    expect(useActiveCommunityStore.getState().membership).toEqual(piso)
    expect(client.getQueryData(myCommunitiesKey)).toEqual([casa, piso])
    expect(client.getQueryState(myCommunitiesKey)?.isInvalidated).toBe(true)
  })

  it('funciona cuando todavía no se había cargado ninguna lista', async () => {
    const client = createQueryClient()
    const { result } = await renderHook(() => useEnterCommunity(), { wrapper: wrapperFor(client) })

    await act(async () => {
      await result.current(casa)
    })

    expect(client.getQueryData(myCommunitiesKey)).toEqual([casa])
  })

  it('una carga que iba en vuelo sin la lista nueva no la borra al aterrizar', async () => {
    const client = createQueryClient()
    client.setQueryData<Membership[]>(myCommunitiesKey, [casa])
    let land: (value: Membership[]) => void = () => undefined
    const inFlight = client
      .fetchQuery({
        queryKey: myCommunitiesKey,
        queryFn: () =>
          new Promise<Membership[]>((resolve) => {
            land = resolve
          }),
      })
      .catch(() => undefined)
    const { result } = await renderHook(() => useEnterCommunity(), { wrapper: wrapperFor(client) })

    await act(async () => {
      await result.current(piso)
      land([casa])
      await inFlight
    })

    expect(client.getQueryData(myCommunitiesKey)).toEqual([casa, piso])
  })
})
