import { fireEvent, render } from '@testing-library/react-native'

import type { Item } from '../../../domain/item'
import { ItemsScreen } from '../ItemsScreen'

function renderScreen() {
  return render(<ItemsScreen />)
}

const mockToggle = jest.fn()
const mockRemove = jest.fn()

const mockItems: Item[] = Array.from({ length: 200 }, (_, index) => {
  const isPurchased = index >= 150
  return {
    id: `item-${index + 1}`,
    name: `Artículo de prueba ${index + 1}${index % 10 === 0 ? ' con nombre largo descriptivo para test de layout' : ''}`,
    quantity: (index % 5) + 1,
    isPurchased,
    imagePath: index % 7 === 0 ? `photos/comm-1/item-${index + 1}.jpg` : null,
    catalogProductId: index % 9 === 0 ? `cat-${index + 1}` : null,
    createdAt: new Date(Date.now() - index * 60000).toISOString(),
  }
})

jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('../../components/EditItemDialog', () => ({
  EditItemDialog: () => null,
}))

jest.mock('../../components/AddItemBar', () => ({
  AddItemBar: () => null,
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'items.sections.pending') return 'Pendientes'
      if (key === 'items.sections.purchased') return 'Comprados'
      if (key === 'list.signedInAs') return `Conectado como ${params?.username}`
      if (key === 'items.markPurchased') return `Marcar comprado ${params?.name}`
      if (key === 'items.markPending') return `Marcar pendiente ${params?.name}`
      return key
    },
  }),
}))

jest.mock('@/features/community', () => ({
  JoinCodeCard: () => null,
  ViewersLine: () => null,
  useViewers: () => ['Ale', 'Beatriz'],
  useActiveCommunityStore: (selector: (state: unknown) => unknown) =>
    selector({
      membership: {
        community: {
          id: 'comm-test-200',
          name: 'Comunidad Benchmark 200',
          joinCode: 'BNCH-200',
          joinCodeExpiresAt: '2026-09-12T12:00:00Z',
          createdAt: '2026-09-01T10:00:00Z',
        },
        username: 'Tester',
        role: 'admin',
      },
      leave: jest.fn(),
    }),
}))

jest.mock('@/features/catalog', () => ({
  useCatalogProducts: () => ({}),
  CatalogSuggestions: () => null,
}))

jest.mock('@/shared/hooks/use-sync-status', () => ({
  useSyncStatus: () => ({ online: true, pendingChanges: 0 }),
}))

jest.mock('@/shared/hooks/use-failure-message', () => ({
  useFailureMessage: () => jest.fn(),
}))

jest.mock('../../hooks/use-items', () => ({
  useItems: () => ({
    data: mockItems,
    isLoading: false,
    isError: false,
    isPaused: false,
    error: null,
    isFetching: false,
    refetch: jest.fn(),
  }),
}))

jest.mock('../../hooks/use-item-image-url', () => ({
  useItemImageUrl: () => ({ data: null }),
}))

jest.mock('../../hooks/use-items-realtime', () => ({
  useItemsRealtime: () => 'connected',
}))

jest.mock('../../hooks/use-add-item', () => ({
  useAddItem: () => ({ mutate: jest.fn() }),
}))

jest.mock('../../hooks/use-toggle-purchased', () => ({
  useTogglePurchased: () => ({ mutate: mockToggle }),
}))

jest.mock('../../hooks/use-edit-item', () => ({
  useEditItem: () => ({
    mutate: jest.fn(),
    isPending: false,
    variables: null,
  }),
}))

jest.mock('../../hooks/use-delete-item', () => ({
  useDeleteItem: () => mockRemove,
}))

jest.mock('../../hooks/use-export-list-pdf', () => ({
  useExportListPdf: () => ({
    exportPdf: jest.fn(),
    isExporting: false,
  }),
}))

describe('ItemsScreen — Prueba de render con 200 artículos virtualizados', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renderiza la lista de 200 artículos en menos de 1 segundo sin errores', async () => {
    const t0 = Date.now()
    const view = await renderScreen()
    const elapsedMs = Date.now() - t0

    expect(view.getByText('Comunidad Benchmark 200')).toBeTruthy()
    expect(view.getByText('Pendientes')).toBeTruthy()
    // La cabecera "Comprados" está en el ítem 150, por lo que la virtualización no la monta inicialmente
    expect(view.queryByText('Comprados')).toBeNull()

    // El renderizado de 200 ítems virtualizados en JS debe ser ágil
    expect(elapsedMs).toBeLessThan(1000)
  })

  it('aplica virtualización activa: renderiza la ventana inicial y no monta ítems fuera de pantalla', async () => {
    const view = await renderScreen()

    // Los primeros ítems dentro de initialNumToRender (14) están en el árbol
    expect(
      view.getByText('Artículo de prueba 1 con nombre largo descriptivo para test de layout'),
    ).toBeTruthy()
    expect(view.getByText('Artículo de prueba 10')).toBeTruthy()

    // Los ítems lejanos (ej. ítem 100 o 150) NO están en el árbol inicial gracias a la virtualización
    expect(view.queryByText('Artículo de prueba 100')).toBeNull()
    expect(
      view.queryByText('Artículo de prueba 151 con nombre largo descriptivo para test de layout'),
    ).toBeNull()
  })

  it('permite marcar un artículo pendiente llamando a la mutación toggle', async () => {
    const view = await renderScreen()

    const checkbox = view.getByLabelText(
      'Marcar comprado Artículo de prueba 1 con nombre largo descriptivo para test de layout',
    )
    fireEvent.press(checkbox)

    expect(mockToggle).toHaveBeenCalledTimes(1)
    expect(mockToggle).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'item-1',
        isPurchased: false,
      }),
    )
  })
})



