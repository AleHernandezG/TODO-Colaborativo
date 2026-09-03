import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { dayOf, unknownDay } from '../../domain/movements'

export function useDayLabel() {
  const { t } = useTranslation()

  return useCallback(
    (day: string) => {
      if (day === unknownDay) {
        return t('expenses.unknownDate')
      }

      const now = new Date()
      if (day === dayOf(now.toISOString())) {
        return t('expenses.today')
      }

      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      if (day === dayOf(yesterday.toISOString())) {
        return t('expenses.yesterday')
      }

      const [year, month, date] = day.split('-')
      return `${date}/${month}/${year}`
    },
    [t],
  )
}
