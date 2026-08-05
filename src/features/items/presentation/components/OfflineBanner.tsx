import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

export function OfflineBanner({ pendingChanges }: { pendingChanges: number }) {
  const { t } = useTranslation()

  const message =
    pendingChanges > 0
      ? t('list.offline.pending', { count: pendingChanges })
      : t('list.offline.viewingCached')

  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
      className="flex-row items-center gap-2 rounded-md bg-surface px-3 py-2 dark:bg-surface-dark"
    >
      <Text className="text-base text-muted dark:text-muted-dark">☁</Text>
      <Text className="flex-1 text-sm text-muted dark:text-muted-dark">{message}</Text>
    </View>
  )
}
