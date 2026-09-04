import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSnackbar } from '@/shared/hooks/use-snackbar'

import { expoListPdfExporter, type ListPdfExporter } from '../../data/expo-pdf-exporter'
import { buildListPdfHtml } from '../../domain/build-list-pdf-html'
import type { Item } from '../../domain/item'

type UseExportListPdfParams = {
  communityName: string
  items: Item[] | undefined
  exporter?: ListPdfExporter
}

export function useExportListPdf({
  communityName,
  items,
  exporter = expoListPdfExporter,
}: UseExportListPdfParams) {
  const { t, i18n } = useTranslation()
  const showSnackbar = useSnackbar()
  const [isExporting, setIsExporting] = useState(false)

  const exportPdf = useCallback(async () => {
    if (!items || items.length === 0) {
      showSnackbar(t('items.pdf.emptyList'))
      return
    }

    if (isExporting) {
      return
    }

    setIsExporting(true)
    try {
      const locale = i18n.language.startsWith('en') ? 'en-US' : 'es-ES'
      const formattedDate = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date())

      const html = buildListPdfHtml({
        communityName,
        items,
        labels: {
          title: t('items.pdf.docTitle'),
          pendingSection: t('items.sections.pending'),
          purchasedSection: t('items.sections.purchased'),
          emptySection: t('items.pdf.emptySection'),
          totalSummary: t('items.pdf.totalSummary'),
          generatedAt: t('items.pdf.generatedAt'),
        },
        formattedDate,
      })

      const dialogTitle = t('items.pdf.shareTitle', { name: communityName })
      const result = await exporter.exportPdf({ html, dialogTitle })

      if (!result.success) {
        if (result.reason === 'sharing_unavailable') {
          showSnackbar(t('items.pdf.sharingUnavailable'))
        } else {
          showSnackbar(t('items.pdf.error'))
        }
      }
    } catch {
      showSnackbar(t('items.pdf.error'))
    } finally {
      setIsExporting(false)
    }
  }, [communityName, items, exporter, isExporting, t, i18n.language, showSnackbar])

  return {
    exportPdf,
    isExporting,
  }
}
