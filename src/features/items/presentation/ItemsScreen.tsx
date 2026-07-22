import { Redirect, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, RefreshControl, SectionList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { OfflineError } from '../../../shared/lib/network'
import { Button } from '../../../shared/ui/Button'
import type { Community } from '../../community/domain/community'
import { useActiveCommunityStore } from '../../community/presentation/active-community-store'
import type { Item } from '../domain/item'
import { AddItemBar } from './components/AddItemBar'
import { ItemRow } from './components/ItemRow'
import { useAddItem } from './use-add-item'
import { useDeleteItem } from './use-delete-item'
import { useItems } from './use-items'
import { useTogglePurchased } from './use-toggle-purchased'

type Section = { title: string; data: Item[] }

export function ItemsScreen() {
  const membership = useActiveCommunityStore((state) => state.membership)

  if (!membership) {
    return <Redirect href="/" />
  }

  return <ItemsView community={membership.community} username={membership.username} />
}

function ItemsView({ community, username }: { community: Community; username: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const leave = useActiveCommunityStore((state) => state.leave)
  const { data: items, isLoading, isError, error, isFetching, refetch } = useItems(community.id)
  const addItem = useAddItem(community.id)
  const togglePurchased = useTogglePurchased(community.id)
  const removeItem = useDeleteItem(community.id)

  const sections = useMemo<Section[]>(() => {
    const all = items ?? []
    const pending = all.filter((item) => !item.isPurchased)
    const purchased = all.filter((item) => item.isPurchased)
    const result: Section[] = []
    if (pending.length > 0) {
      result.push({ title: t('items.sections.pending'), data: pending })
    }
    if (purchased.length > 0) {
      result.push({ title: t('items.sections.purchased'), data: purchased })
    }
    return result
  }, [items, t])

  const loadErrorMessage =
    error instanceof OfflineError ? t('errors.offline') : t('items.loadError')

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-1 gap-4 px-6 py-6">
        <View className="gap-1">
          <Text
            accessibilityRole="header"
            className="text-3xl font-bold text-content dark:text-content-dark"
          >
            {community.name}
          </Text>
          <Text className="text-base text-muted dark:text-muted-dark">
            {t('list.signedInAs', { username })}
          </Text>
        </View>

        <AddItemBar onAdd={(input) => addItem.mutate(input)} />

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ItemRow
              item={item}
              onToggle={() => togglePurchased.mutate(item)}
              onDelete={() => removeItem(item)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <Text
              accessibilityRole="header"
              className="pt-2 text-sm font-semibold uppercase text-muted dark:text-muted-dark"
            >
              {section.title}
            </Text>
          )}
          contentContainerStyle={{ gap: 8, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => void refetch()}
            />
          }
          ListEmptyComponent={
            isLoading ? (
              <LoadingList />
            ) : isError ? (
              <ListError message={loadErrorMessage} onRetry={() => void refetch()} />
            ) : (
              <EmptyList />
            )
          }
        />

        <View className="gap-3 border-t border-line pt-4 dark:border-line-dark">
          <View className="gap-1">
            <Text className="text-sm text-muted dark:text-muted-dark">
              {t('list.joinCodeLabel')}
            </Text>
            <Text
              accessibilityLabel={t('list.joinCodeAccessible', {
                code: community.joinCode.split('').join(' '),
              })}
              className="text-2xl font-bold tracking-widest text-content dark:text-content-dark"
            >
              {community.joinCode}
            </Text>
            <Text className="text-sm text-muted dark:text-muted-dark">
              {t('list.joinCodeHint')}
            </Text>
          </View>
          <Button
            label={t('list.leave')}
            onPress={() => {
              leave()
              router.replace('/')
            }}
            variant="secondary"
            accessibilityHint={t('list.leaveHint')}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}

function LoadingList() {
  const { t } = useTranslation()
  return (
    <View
      accessible
      accessibilityLabel={t('items.loading')}
      className="flex-1 items-center justify-center py-10"
    >
      <ActivityIndicator size="large" />
    </View>
  )
}

function EmptyList() {
  const { t } = useTranslation()
  return (
    <View className="flex-1 items-center justify-center py-10">
      <Text className="text-center text-base text-muted dark:text-muted-dark">
        {t('items.empty')}
      </Text>
    </View>
  )
}

function ListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <View className="flex-1 items-center justify-center gap-4 py-10">
      <Text
        accessibilityLiveRegion="polite"
        className="text-center text-base text-muted dark:text-muted-dark"
      >
        {message}
      </Text>
      <Button label={t('common.retry')} onPress={onRetry} variant="secondary" />
    </View>
  )
}
