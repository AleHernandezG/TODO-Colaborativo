import { fireEvent, render, screen } from '@testing-library/react-native'

import type { Membership } from '../../../domain/community'
import { useActiveCommunityStore } from '../../stores/active-community-store'
import { MyListsShortcut } from '../MyListsShortcut'

let mockData: Membership[] | undefined

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${Object.values(params).join(' ')}` : key,
  }),
}))

jest.mock('../../hooks/use-my-communities', () => ({
  useMyCommunities: () => ({ data: mockData }),
}))

const casa: Membership = {
  community: { id: 'c1', name: 'Casa', joinCode: 'CODE-c1' },
  username: 'Ana',
}

describe('MyListsShortcut', () => {
  beforeEach(() => {
    useActiveCommunityStore.setState({ membership: null })
  })

  it('no pinta nada mientras no se sabe si tengo listas', async () => {
    mockData = undefined
    await render(<MyListsShortcut />)

    expect(screen.queryByText('lists.backToYours')).toBeNull()
  })

  it('no pinta nada si no estoy en ninguna', async () => {
    mockData = []
    await render(<MyListsShortcut />)

    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('ofrece mis listas sin marcar ninguna y entra en la que se toca', async () => {
    mockData = [casa]
    await render(<MyListsShortcut />)

    const option = screen.getByRole('radio', { name: 'lists.option Casa Ana' })
    expect(option).not.toBeChecked()

    await fireEvent.press(option)
    expect(useActiveCommunityStore.getState().membership).toEqual(casa)
  })
})
