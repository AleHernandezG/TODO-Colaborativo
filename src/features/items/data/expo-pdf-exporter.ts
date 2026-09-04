import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

export type ExportPdfOptions = {
  html: string
  dialogTitle: string
}

export type ExportPdfResult =
  | { success: true }
  | { success: false; reason: 'sharing_unavailable' | 'error'; error?: unknown }

export type ListPdfExporter = {
  exportPdf(options: ExportPdfOptions): Promise<ExportPdfResult>
}

export const expoListPdfExporter: ListPdfExporter = {
  async exportPdf({ html, dialogTitle }: ExportPdfOptions): Promise<ExportPdfResult> {
    try {
      const isSharingAvailable = await Sharing.isAvailableAsync()
      if (!isSharingAvailable) {
        return { success: false, reason: 'sharing_unavailable' }
      }

      const { uri } = await Print.printToFileAsync({ html })

      await Sharing.shareAsync(uri, {
        dialogTitle,
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      })

      return { success: true }
    } catch (error) {
      return { success: false, reason: 'error', error }
    }
  },
}
