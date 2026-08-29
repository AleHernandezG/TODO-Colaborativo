import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, View } from 'react-native'

import { Button } from '@/shared/ui/Button'

import type { SessionErrorReason } from '../domain/session-error'
import { useSessionBootstrap } from './use-session-bootstrap'

const errorKeys: Record<SessionErrorReason, string> = {
  offline: 'errors.offline',
  anonymous_disabled: 'session.errors.anonymousDisabled',
  unknown: 'session.errors.unknown',
}

export function SessionGate({ children }: { children: ReactNode }) {
  const { status, error, retry } = useSessionBootstrap()
  const { t } = useTranslation()

  if (status === 'ready') {
    return <>{children}</>
  }

  if (status === 'error') {
    return (
      <View className="flex-1 justify-center gap-4 bg-background px-6 dark:bg-background-dark">
        <Text
          accessibilityRole="header"
          className="text-2xl font-bold text-content dark:text-content-dark"
        >
          {t('session.errorTitle')}
        </Text>
        <Text className="text-base text-muted dark:text-muted-dark">
          {t(errorKeys[error ?? 'unknown'])}
        </Text>
        <Button label={t('common.retry')} onPress={retry} />
      </View>
    )
  }

  return (
    <View
      accessibilityLabel={t('session.starting')}
      className="flex-1 items-center justify-center bg-background dark:bg-background-dark"
    >
      <ActivityIndicator size="large" />
    </View>
  )
}
