import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

import { expoListPdfExporter } from '../expo-pdf-exporter'

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(),
}))

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}))

describe('expoListPdfExporter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('devuelve sharing_unavailable si el dispositivo no soporta compartir', async () => {
    ;(Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false)

    const result = await expoListPdfExporter.exportPdf({
      html: '<html></html>',
      dialogTitle: 'Lista',
    })

    expect(result).toEqual({ success: false, reason: 'sharing_unavailable' })
    expect(Print.printToFileAsync).not.toHaveBeenCalled()
  })

  it('genera el PDF y abre la hoja de compartir si está disponible', async () => {
    ;(Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true)
    ;(Print.printToFileAsync as jest.Mock).mockResolvedValue({ uri: 'file:///tmp/list.pdf' })
    ;(Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined)

    const result = await expoListPdfExporter.exportPdf({
      html: '<html></html>',
      dialogTitle: 'Lista de la compra',
    })

    expect(result).toEqual({ success: true })
    expect(Print.printToFileAsync).toHaveBeenCalledWith({ html: '<html></html>' })
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/list.pdf', {
      dialogTitle: 'Lista de la compra',
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    })
  })

  it('captura errores inesperados y devuelve motivo error', async () => {
    ;(Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true)
    const err = new Error('Disk full')
    ;(Print.printToFileAsync as jest.Mock).mockRejectedValue(err)

    const result = await expoListPdfExporter.exportPdf({
      html: '<html></html>',
      dialogTitle: 'Lista',
    })

    expect(result).toEqual({ success: false, reason: 'error', error: err })
  })
})
