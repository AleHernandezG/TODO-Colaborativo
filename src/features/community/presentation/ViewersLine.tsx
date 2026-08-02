import { useTranslation } from 'react-i18next'
import { Text } from 'react-native'

import { summarizeViewers } from '../domain/viewers'

export function ViewersLine({ names }: { names: string[] }) {
  const { t } = useTranslation()

  if (names.length === 0) {
    return null
  }

  const { shown, hidden } = summarizeViewers(names)
  const joined = shown.join(', ')
  const text =
    hidden > 0
      ? t('list.viewers.andMore', { names: joined, count: hidden })
      : t('list.viewers.viewing', { names: joined, count: shown.length })

  return (
    <Text
      accessibilityLiveRegion="polite"
      className="text-sm text-muted dark:text-muted-dark"
    >
      {text}
    </Text>
  )
}
