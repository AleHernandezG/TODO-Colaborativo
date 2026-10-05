import { renderHook, waitFor } from '@testing-library/react-native'

import { useSnackbarStore } from '@/shared/hooks/use-snackbar'

import { supabaseCommunityRepository } from '../../../data/supabase-community-repository'
import type { Membership } from '../../../domain/community'
import { useActiveCommunityStore } from '../../stores/active-community-store'
import { createQueryClient, membership, wrapperFor } from '../__fixtures__/query-wrapper'
import { useActiveMembershipSync } from '../use-active-membership-sync'
import { myCommunitiesKey } from '../use-my-communities'

jest.mock('../../../data/supabase-community-repository', () => ({
  supabaseCommunityRepository: { listMine: jest.fn() },
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
  }),
}))

const listMine = supabaseCommunityRepository.listMine as jest.Mock

const casa = membership('c1', 'Casa')
const piso = membership('c2', 'Piso')

async function mount(client = createQueryClient()) {
  await renderHook(() => useActiveMembershipSync(), { wrapper: wrapperFor(client) })
  return client
}

describe('useActiveMembershipSync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useActiveCommunityStore.setState({ membership: casa })
    useSnackbarStore.setState({ message: null, action: null })
  })

  it('no toca nada si sigo en la lista activa', async () => {
    listMine.mockResolvedValue([casa, piso])
    const client = await mount()

    await waitFor(() => expect(client.getQueryData(myCommunitiesKey)).toEqual([casa, piso]))

    expect(useActiveCommunityStore.getState().membership).toBe(casa)
    expect(useSnackbarStore.getState().message).toBeNull()
  })

  it('actualiza la activa si alguien le cambió el nombre desde otro móvil', async () => {
    const renamed = membership('c1', 'Casa de la playa')
    listMine.mockResolvedValue([renamed])
    await mount()

    await waitFor(() => expect(useActiveCommunityStore.getState().membership).toEqual(renamed))
    expect(useSnackbarStore.getState().message).toBeNull()
  })

  it('me lleva a otra lista y lo avisa si me quitaron de la activa', async () => {
    listMine.mockResolvedValue([piso])
    await mount()

    await waitFor(() => expect(useActiveCommunityStore.getState().membership).toEqual(piso))
    expect(useSnackbarStore.getState().message).toBe(
      'lists.removedAndMoved {"name":"Casa","next":"Piso"}',
    )
  })

  it('me saca a la portada y lo avisa si no me queda ninguna', async () => {
    listMine.mockResolvedValue([])
    await mount()

    await waitFor(() => expect(useActiveCommunityStore.getState().membership).toBeNull())
    expect(useSnackbarStore.getState().message).toBe('lists.removed {"name":"Casa"}')
  })

  it('no echa a nadie si la carga falla', async () => {
    listMine.mockRejectedValue(new Error('sin red'))
    const client = await mount()

    await waitFor(() => expect(client.getQueryState(myCommunitiesKey)?.status).toBe('error'))

    expect(useActiveCommunityStore.getState().membership).toBe(casa)
    expect(useSnackbarStore.getState().message).toBeNull()
  })

  it('no decide con la copia guardada: espera a la respuesta del servidor', async () => {
    let answer: (value: Membership[]) => void = () => undefined
    listMine.mockReturnValue(
      new Promise<Membership[]>((resolve) => {
        answer = resolve
      }),
    )
    const client = createQueryClient()
    client.setQueryData<Membership[]>(myCommunitiesKey, [piso])
    await mount(client)

    await waitFor(() => expect(listMine).toHaveBeenCalled())
    expect(useActiveCommunityStore.getState().membership).toBe(casa)

    answer([casa, piso])
    await waitFor(() => expect(client.getQueryData(myCommunitiesKey)).toEqual([casa, piso]))
    expect(useActiveCommunityStore.getState().membership).toBe(casa)
  })
})
