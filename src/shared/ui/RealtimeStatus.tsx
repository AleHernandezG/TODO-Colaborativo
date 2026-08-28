import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

export type ChannelStatus = 'connecting' | 'connected' | 'disconnected'

const graceMs = 2000

export function RealtimeStatus({ status }: { status: ChannelStatus }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (status === 'connected') {
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), graceMs)
    return () => clearTimeout(timer)
  }, [status])

  if (!visible) {
    return null
  }

  const connecting = status === 'connecting'

  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={
        connecting ? t('list.realtime.connecting') : t('list.realtime.disconnected')
      }
      className="flex-row items-center gap-2 rounded-md bg-surface px-3 py-2 dark:bg-surface-dark"
    >
      <Text className="text-base text-muted dark:text-muted-dark">{connecting ? '↻' : '⚠'}</Text>
      <Text className="flex-1 text-sm text-muted dark:text-muted-dark">
        {connecting ? t('list.realtime.connecting') : t('list.realtime.disconnected')}
      </Text>
    </View>
  )
}
