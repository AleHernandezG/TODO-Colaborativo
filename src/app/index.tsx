import { Redirect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  useActiveCommunityHydrated,
  useActiveCommunityStore,
} from '@/features/community'
import { Button } from '@/shared/ui/Button'

export default function Landing() {
  const { t } = useTranslation()
  const router = useRouter()
  const hydrated = useActiveCommunityHydrated()
  const membership = useActiveCommunityStore((state) => state.membership)

  if (!hydrated) {
    return (
      <View
        accessibilityLabel={t('session.starting')}
        className="flex-1 items-center justify-center bg-background dark:bg-background-dark"
      >
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (membership) {
    return <Redirect href="/list" />
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-1 justify-between px-6 py-10">
        <View className="flex-1 justify-center gap-4">
          <Text
            accessibilityRole="header"
            className="text-4xl font-bold text-content dark:text-content-dark"
          >
            {t('landing.title')}
          </Text>
          <Text className="text-lg text-muted dark:text-muted-dark">{t('landing.subtitle')}</Text>
        </View>

        <View className="gap-3">
          <Button label={t('landing.createCommunity')} onPress={() => router.push('/create')} />
          <Button
            label={t('landing.joinCommunity')}
            onPress={() => router.push('/join')}
            variant="secondary"
          />
        </View>
      </View>
    </SafeAreaView>
  )
}
