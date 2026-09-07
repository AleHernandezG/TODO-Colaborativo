import { fireEvent, render, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { Text } from 'react-native'

import { useActiveCommunityStore } from '@/features/community'
import i18n from '@/shared/lib/i18n'

import type { Item } from '../../../domain/item'
import { ShoppingModeScreen } from '../ShoppingModeScreen'

const mockPush = jest.fn()
const mockBack = jest.fn()
const mockReplace = jest.fn()

jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
}))

const mockToggle = jest.fn()

const mockItems: Item[] = [
  {
    id: '1',
    name: 'Manzanas',
    quantity: 2,
    isPurchased: false,
    imagePath: null,
    catalogProductId: null,
    category: 'fruits_vegetables',
    createdAt: '2026-09-07T10:00:00Z',
  },
  {
    id: '2',
    name: 'Leche',
    quantity: 1,
    isPurchased: true,
    imagePath: null,
    catalogProductId: null,
    category: 'dairy_eggs',
    createdAt: '2026-09-07T10:01:00Z',
  },
]

jest.mock('../../hooks/use-items', () => ({
  useItems: () => ({ data: mockItems, isLoading: false }),
}))

jest.mock('../../hooks/use-toggle-purchased', () => ({
  useTogglePurchased: () => ({ mutate: mockToggle }),
}))

jest.mock('@/shared/lib/keep-awake', () => ({
  useKeepAwakeSafe: jest.fn(),
}))

const MockDialog = ({
  visible,
  title,
  confirmLabel,
  onConfirm,
  children,
}: {
  visible: boolean
  title: string
  confirmLabel: string
  onConfirm: () => void
  children?: ReactNode
}) => {
  if (!visible) return null
  return (
    <>
      <Text>{title}</Text>
      {children}
      <Text onPress={onConfirm} accessibilityRole="button" accessibilityLabel={confirmLabel}>
        {confirmLabel}
      </Text>
    </>
  )
}

jest.mock('@/shared/ui/Dialog', () => ({
  Dialog: (props: any) => MockDialog(props),
}))

function renderComponent() {
  return render(<ShoppingModeScreen />)
}

describe('ShoppingModeScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await i18n.changeLanguage('es')
    useActiveCommunityStore.setState({
      membership: {
        community: { id: 'comm-1', name: 'Mi Casa', joinCode: 'ABCD-1234' },
        username: 'Alex',
      },
    })
  })

  it('renderiza el título, progreso y artículos pendientes por defecto', async () => {
    const view = await renderComponent()

    expect(view.getByText('Modo Supermercado')).toBeTruthy()
    expect(view.getByText('Mi Casa')).toBeTruthy()
    // 1 comprado de 2 = 50%
    expect(view.getByText('50%')).toBeTruthy()
    // En filtro "Por comprar", solo Manzanas aparece
    expect(view.getByText('Manzanas')).toBeTruthy()
    expect(view.queryByText('Leche')).toBeNull()
  })

  it('permite cambiar al filtro de comprados y ver en el carro', async () => {
    const view = await renderComponent()

    const inCartTab = view.getByRole('tab', { name: /En el carro/ })
    fireEvent.press(inCartTab)

    await waitFor(() => {
      expect(view.getByText('Leche')).toBeTruthy()
      expect(view.queryByText('Manzanas')).toBeNull()
    })
  })

  it('pulsar un artículo llama a togglePurchased', async () => {
    const view = await renderComponent()

    const itemRow = view.getByLabelText('2 Manzanas')
    fireEvent.press(itemRow)

    expect(mockToggle).toHaveBeenCalledWith(mockItems[0])
  })

  it('abrir diálogo de finalizar compra y confirmar', async () => {
    const view = await renderComponent()

    const finishButton = view.getByRole('button', { name: 'Finalizar compra' })
    fireEvent.press(finishButton)

    await waitFor(() => {
      expect(view.getByText('¿Finalizar la compra?')).toBeTruthy()
    })

    const confirmButton = view.getByRole('button', { name: 'Finalizar y salir' })
    fireEvent.press(confirmButton)

    expect(mockReplace).toHaveBeenCalledWith('/list')
  })
})
