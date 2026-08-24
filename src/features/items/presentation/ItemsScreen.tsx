import { Redirect, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, RefreshControl, SectionList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useSyncStatus } from '../../../shared/hooks/use-sync-status'
import { OfflineError } from '../../../shared/lib/network'
import { BuildTag } from '../../../shared/ui/BuildTag'
import { Button } from '../../../shared/ui/Button'
import type { CatalogProductsById } from '../../catalog/domain/catalog-products-by-id'
import { useCatalogProducts } from '../../catalog/presentation/use-catalog-products'
import type { Community } from '../../community/domain/community'
import { useActiveCommunityStore } from '../../community/presentation/active-community-store'
import { JoinCodeCard } from '../../community/presentation/JoinCodeCard'
import { useViewers } from '../../community/presentation/use-viewers'
import { ViewersLine } from '../../community/presentation/ViewersLine'
import type { Item } from '../domain/item'
import { catalogImageProductIds, itemImageSource } from '../domain/item-image-source'
import { AddItemBar } from './components/AddItemBar'
import { EditItemDialog } from './components/EditItemDialog'
import { ItemRow } from './components/ItemRow'
import { OfflineBanner } from './components/OfflineBanner'
import { RealtimeStatus } from './components/RealtimeStatus'
import { useAddItem } from './use-add-item'
import { useDeleteItem } from './use-delete-item'
import { useEditItem } from './use-edit-item'
import { useItems } from './use-items'
import { useItemsRealtime } from './use-items-realtime'
import { useTogglePurchased } from './use-toggle-purchased'

type Section = { title: string; data: Item[] }

function catalogImageUrl(item: Item, products: CatalogProductsById): string | null {
  const source = itemImageSource(item)
  if (source.kind !== 'catalog') {
    return null
  }
  return products[source.productId]?.imageUrl ?? null
}

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
  const {
    data: items,
    isLoading,
    isError,
    isPaused,
    error,
    isFetching,
    refetch,
  } = useItems(community.id)
  const { online, pendingChanges } = useSyncStatus()
  const addItem = useAddItem(community.id)
  const togglePurchased = useTogglePurchased(community.id)
  const editItem = useEditItem(community.id)
  const removeItem = useDeleteItem(community.id)
  const [itemBeingEdited, setItemBeingEdited] = useState<Item | null>(null)

  const uploadingImageItemId =
    editItem.isPending && editItem.variables?.image.kind === 'replace'
      ? editItem.variables.itemId
      : null

  const realtimeStatus = useItemsRealtime(community.id)
  const viewers = useViewers(community.id, username)

  const catalogIds = useMemo(() => catalogImageProductIds(items ?? []), [items])
  const catalogProducts = useCatalogProducts(catalogIds)

  const { sections, allDone } = useMemo(() => {
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
    return { sections: result, allDone: all.length > 0 && pending.length === 0 }
  }, [items, t])

  const loadErrorMessage =
    error instanceof OfflineError ? t('errors.offline') : t('items.loadError')

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            uploadingImage={item.id === uploadingImageItemId}
            catalogImageUrl={catalogImageUrl(item, catalogProducts)}
            onToggle={() => togglePurchased.mutate(item)}
            onEdit={() => setItemBeingEdited(item)}
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
        contentContainerStyle={{ gap: 8, flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} />
        }
        ListHeaderComponent={
          <View className="gap-4 pb-2">
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
              <ViewersLine names={viewers} />
            </View>

            {online ? (
              <RealtimeStatus status={realtimeStatus} />
            ) : (
              <OfflineBanner pendingChanges={pendingChanges} />
            )}

            <AddItemBar onAdd={(input) => addItem.mutate(input)} />

            {allDone ? <AllDoneBanner /> : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingList />
          ) : isPaused ? (
            <NoCachedList />
          ) : isError ? (
            <ListError message={loadErrorMessage} onRetry={() => void refetch()} />
          ) : (
            <EmptyList />
          )
        }
        ListFooterComponent={
          <View className="mt-4 gap-2 border-t border-line pt-4 dark:border-line-dark">
            <JoinCodeCard communityId={community.id} communityName={community.name} />
            <Button
              label={t('list.leave')}
              onPress={() => {
                leave()
                router.replace('/')
              }}
              variant="secondary"
              size="sm"
              accessibilityHint={t('list.leaveHint')}
            />
            <BuildTag />
          </View>
        }
      />

      <EditItemDialog
        item={itemBeingEdited}
        catalogImageUrl={
          itemBeingEdited === null ? null : catalogImageUrl(itemBeingEdited, catalogProducts)
        }
        onDismiss={() => setItemBeingEdited(null)}
        onSave={(input) => editItem.mutate(input)}
      />
    </SafeAreaView>
  )
}

function AllDoneBanner() {
  const { t } = useTranslation()
  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={t('items.allDone')}
      className="flex-row items-center gap-2 rounded-md bg-surface px-3 py-2 dark:bg-surface-dark"
    >
      <Text className="text-base">🎉</Text>
      <Text className="flex-1 text-sm font-medium text-content dark:text-content-dark">
        {t('items.allDone')}
      </Text>
    </View>
  )
}

function LoadingList() {
  const { t } = useTranslation()
  return (
    <View
      accessible
      accessibilityLabel={t('items.loading')}
      className="flex-1 items-center justify-center gap-3 py-10"
    >
      <ActivityIndicator size="large" />
      <Text className="text-base text-muted dark:text-muted-dark">{t('items.loading')}</Text>
    </View>
  )
}

function EmptyList() {
  const { t } = useTranslation()
  return (
    <View accessible className="flex-1 items-center justify-center gap-2 py-10">
      <Text className="text-5xl">🛒</Text>
      <Text
        accessibilityRole="header"
        className="text-center text-lg font-semibold text-content dark:text-content-dark"
      >
        {t('items.emptyTitle')}
      </Text>
      <Text className="text-center text-base text-muted dark:text-muted-dark">
        {t('items.empty')}
      </Text>
    </View>
  )
}

function NoCachedList() {
  const { t } = useTranslation()
  return (
    <View accessible className="flex-1 items-center justify-center gap-2 py-10">
      <Text className="text-5xl">☁</Text>
      <Text className="text-center text-base text-muted dark:text-muted-dark">
        {t('list.offline.noList')}
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
