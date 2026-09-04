import { act, renderHook } from '@testing-library/react-native'

import { useSnackbarStore } from '@/shared/hooks/use-snackbar'

import type { ListPdfExporter } from '../../../data/expo-pdf-exporter'
import type { Item } from '../../../domain/item'
import { useExportListPdf } from '../use-export-list-pdf'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) => {
      if (options?.name) return `${key}:${options.name}`
      return key
    },
    i18n: { language: 'es' },
  }),
}))

describe('useExportListPdf', () => {
  const mockItems: Item[] = [
    {
      id: '1',
      name: 'Manzanas',
      quantity: 3,
      isPurchased: false,
      imagePath: null,
      catalogProductId: null,
      createdAt: '2026-09-01T10:00:00Z',
    },
  ]

  beforeEach(() => {
    useSnackbarStore.setState({ message: null, action: null })
  })

  it('avisa con snackbar si la lista está vacía', async () => {
    const mockExporter: ListPdfExporter = {
      exportPdf: jest.fn(),
    }

    const { result } = await renderHook(() =>
      useExportListPdf({
        communityName: 'Comunidad',
        items: [],
        exporter: mockExporter,
      }),
    )

    await act(async () => {
      await result.current.exportPdf()
    })

    expect(mockExporter.exportPdf).not.toHaveBeenCalled()
    expect(useSnackbarStore.getState().message).toBe('items.pdf.emptyList')
  })

  it('exporta el PDF llamando al exporter si hay artículos', async () => {
    const mockExporter: ListPdfExporter = {
      exportPdf: jest.fn().mockResolvedValue({ success: true }),
    }

    const { result } = await renderHook(() =>
      useExportListPdf({
        communityName: 'Piso 1',
        items: mockItems,
        exporter: mockExporter,
      }),
    )

    await act(async () => {
      await result.current.exportPdf()
    })

    expect(mockExporter.exportPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        dialogTitle: 'items.pdf.shareTitle:Piso 1',
        html: expect.stringContaining('Manzanas'),
      }),
    )
    expect(result.current.isExporting).toBe(false)
  })

  it('muestra aviso si compartir no está disponible', async () => {
    const mockExporter: ListPdfExporter = {
      exportPdf: jest.fn().mockResolvedValue({ success: false, reason: 'sharing_unavailable' }),
    }

    const { result } = await renderHook(() =>
      useExportListPdf({
        communityName: 'Piso 1',
        items: mockItems,
        exporter: mockExporter,
      }),
    )

    await act(async () => {
      await result.current.exportPdf()
    })

    expect(useSnackbarStore.getState().message).toBe('items.pdf.sharingUnavailable')
  })

  it('muestra error si la exportación falla', async () => {
    const mockExporter: ListPdfExporter = {
      exportPdf: jest.fn().mockResolvedValue({ success: false, reason: 'error' }),
    }

    const { result } = await renderHook(() =>
      useExportListPdf({
        communityName: 'Piso 1',
        items: mockItems,
        exporter: mockExporter,
      }),
    )

    await act(async () => {
      await result.current.exportPdf()
    })

    expect(useSnackbarStore.getState().message).toBe('items.pdf.error')
  })
})
