import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import type { Membership } from '../../../domain/community'
import { useActiveCommunityStore } from '../../stores/active-community-store'
import { CommunitySwitcher } from '../CommunitySwitcher'

const mockPush = jest.fn()
const mockRefetch = jest.fn()
let mockQuery: {
  data: Membership[] | undefined
  isError: boolean
  error: unknown
  isFetching: boolean
}

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${Object.values(params).join(' ')}` : key,
  }),
}))

jest.mock('@/shared/ui/PickerDialog', () => ({
  PickerDialog: ({ visible, children }: { visible: boolean; children: ReactNode }) =>
    visible ? children : null,
}))

jest.mock('@/shared/hooks/use-failure-message', () => ({
  useFailureMessage: () => (_cause: unknown, fallback: string) => fallback,
}))

jest.mock('../../hooks/use-my-communities', () => ({
  useMyCommunities: () => ({ ...mockQuery, refetch: mockRefetch }),
}))

function membership(id: string, name: string, username = 'Ana'): Membership {
  return { community: { id, name, joinCode: `CODE-${id}` }, username }
}

const casa = membership('c1', 'Casa')
const piso = membership('c2', 'Piso', 'Anita')

async function openSwitcher() {
  await render(<CommunitySwitcher active={casa} />)
  await fireEvent.press(screen.getByRole('button', { name: 'lists.switcher Casa' }))
}

describe('CommunitySwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockQuery = { data: [casa, piso], isError: false, error: null, isFetching: false }
    useActiveCommunityStore.setState({ membership: casa })
  })

  it('enseña el nombre de la lista activa y no abre nada hasta que se toca', async () => {
    await render(<CommunitySwitcher active={casa} />)

    expect(screen.getByText('Casa')).toBeTruthy()
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('al abrirse lista todas mis listas, marca la activa y pide datos frescos', async () => {
    await openSwitcher()

    expect(screen.getByRole('radio', { name: 'lists.option Casa Ana' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'lists.option Piso Anita' })).not.toBeChecked()
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('tocar otra lista la deja activa y cierra el selector', async () => {
    await openSwitcher()
    await fireEvent.press(screen.getByRole('radio', { name: 'lists.option Piso Anita' }))

    expect(useActiveCommunityStore.getState().membership).toEqual(piso)
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('tocar la que ya está abierta solo cierra', async () => {
    await openSwitcher()
    await fireEvent.press(screen.getByRole('radio', { name: 'lists.option Casa Ana' }))

    expect(useActiveCommunityStore.getState().membership).toBe(casa)
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('lleva a crear y a unirse sin salir de la lista actual', async () => {
    await openSwitcher()
    await fireEvent.press(screen.getByRole('button', { name: 'lists.create' }))
    expect(mockPush).toHaveBeenCalledWith('/create')

    await fireEvent.press(screen.getByRole('button', { name: 'lists.switcher Casa' }))
    await fireEvent.press(screen.getByRole('button', { name: 'lists.join' }))
    expect(mockPush).toHaveBeenCalledWith('/join')
    expect(useActiveCommunityStore.getState().membership).toBe(casa)
  })

  it('sin datos del servidor enseña al menos la lista activa', async () => {
    mockQuery = { data: undefined, isError: false, error: null, isFetching: true }
    await openSwitcher()

    expect(screen.getByRole('radio', { name: 'lists.option Casa Ana' })).toBeChecked()
    expect(screen.getByLabelText('lists.loading')).toBeTruthy()
  })

  it('avisa en línea si mis listas no se pudieron cargar', async () => {
    mockQuery = { data: undefined, isError: true, error: new Error('x'), isFetching: false }
    await openSwitcher()

    expect(screen.getByText('lists.loadError')).toBeTruthy()
    expect(screen.queryByText('lists.onlyOne')).toBeNull()
  })

  it('con una sola lista explica que no hay más', async () => {
    mockQuery = { data: [casa], isError: false, error: null, isFetching: false }
    await openSwitcher()

    expect(screen.getByText('lists.onlyOne')).toBeTruthy()
  })
})
