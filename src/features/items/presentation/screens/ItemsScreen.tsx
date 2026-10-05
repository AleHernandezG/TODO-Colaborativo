import { Redirect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, RefreshControl, SectionList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { CatalogProductsById } from '@/features/catalog'
import { useCatalogProducts } from '@/features/catalog'
import type { Membership } from '@/features/community'
import {
  CommunitySwitcher,
  JoinCodeCard,
  useActiveCommunityStore,
  useActiveMembershipSync,
  useMyCommunities,
  useOpenCommunity,
  useViewers,
  ViewersLine,
} from '@/features/community'
import { usePushNotifications } from '@/features/notifications'
import { useFailureMessage } from '@/shared/hooks/use-failure-message'
import { useSyncStatus } from '@/shared/hooks/use-sync-status'
import { BuildTag } from '@/shared/ui/BuildTag'
import { Button } from '@/shared/ui/Button'
import { OfflineBanner } from '@/shared/ui/OfflineBanner'
import { RealtimeStatus } from '@/shared/ui/RealtimeStatus'
import { usePalette } from '@/theme'

import type { Item } from '../../domain/item'
import { groupItemsByAisle } from '../../domain/item-category'
import { catalogImageProductIds, itemImageSource } from '../../domain/item-image-source'
import { AddItemBar } from '../components/AddItemBar'
import { EditItemDialog } from '../components/EditItemDialog'
import { ItemRow } from '../components/ItemRow'
import { useAddItem } from '../hooks/use-add-item'
import { useDeleteItem } from '../hooks/use-delete-item'
import { useEditItem } from '../hooks/use-edit-item'
import { useExportListPdf } from '../hooks/use-export-list-pdf'
import { useItems } from '../hooks/use-items'
import { useItemsRealtime } from '../hooks/use-items-realtime'
import { useTogglePurchased } from '../hooks/use-toggle-purchased'

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

  return <ActiveList membership={membership} />
}

function ActiveList({ membership }: { membership: Membership }) {
  const activeCommunityId = membership.community.id
  const { data: mine } = useMyCommunities()
  const openCommunity = useOpenCommunity()
  const pushCommunityIds = useMemo(
    () => [...new Set([activeCommunityId, ...(mine ?? []).map((m) => m.community.id)])].sort(),
    [activeCommunityId, mine],
  )

  useActiveMembershipSync()
  usePushNotifications(pushCommunityIds, openCommunity)

  return <ItemsView key={activeCommunityId} membership={membership} />
}

function ItemsView({ membership }: { membership: Membership }) {
  const { community, username } = membership
  const { t } = useTranslation()
  const router = useRouter()
  const palette = usePalette()
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
  const failureMessage = useFailureMessage()
  const addItem = useAddItem(community.id)
  const togglePurchased = useTogglePurchased(community.id)
  const editItem = useEditItem(community.id)
  const removeItem = useDeleteItem(community.id)
  const [itemBeingEdited, setItemBeingEdited] = useState<Item | null>(null)
  const [groupByAisle, setGroupByAisle] = useState(false)

  const uploadingImageItemId =
    editItem.isPending && editItem.variables?.image.kind === 'replace'
      ? editItem.variables.itemId
      : null

  const realtimeStatus = useItemsRealtime(community.id)
  const viewers = useViewers(community.id, username)
  const { exportPdf, isExporting } = useExportListPdf({
    communityName: community.name,
    items,
  })

  const catalogIds = useMemo(() => catalogImageProductIds(items ?? []), [items])
  const catalogProducts = useCatalogProducts(catalogIds)

  const { sections, allDone } = useMemo(() => {
    const all = items ?? []
    const pending = all.filter((item) => !item.isPurchased)
    const purchased = all.filter((item) => item.isPurchased)
    const result: Section[] = []

    if (groupByAisle) {
      const aisleGroups = groupItemsByAisle(pending)
      for (const group of aisleGroups) {
        result.push({
          title: `${group.metadata.icon} ${t(group.metadata.translationKey)} (${group.items.length})`,
          data: group.items,
        })
      }
    } else if (pending.length > 0) {
      result.push({ title: t('items.sections.pending'), data: pending })
    }

    if (purchased.length > 0) {
      result.push({
        title: `${t('items.sections.purchased')} (${purchased.length})`,
        data: purchased,
      })
    }

    return { sections: result, allDone: all.length > 0 && pending.length === 0 }
  }, [items, groupByAisle, t])

  const renderItem = useCallback(
    ({ item }: { item: Item }) => (
      <ItemRow
        item={item}
        uploadingImage={item.id === uploadingImageItemId}
        catalogImageUrl={catalogImageUrl(item, catalogProducts)}
        onToggle={() => togglePurchased.mutate(item)}
        onEdit={() => setItemBeingEdited(item)}
        onDelete={() => removeItem(item)}
      />
    ),
    [uploadingImageItemId, catalogProducts, togglePurchased, removeItem],
  )

  const loadErrorMessage = useMemo(
    () => (isError ? failureMessage(error, t('items.loadError')) : ''),
    [isError, error, failureMessage, t],
  )

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        initialNumToRender={14}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        updateCellsBatchingPeriod={50}
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
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1 gap-1">
                <CommunitySwitcher active={membership} />
                <Text className="text-base text-muted dark:text-muted-dark">
                  {t('list.signedInAs', { username })}
                </Text>
              </View>
              <View className="flex-row flex-wrap items-center justify-end gap-2">
                <Button
                  label={t('items.shoppingMode.button')}
                  onPress={() => router.push('/shopping-mode' as never)}
                  size="sm"
                  fullWidth={false}
                  accessibilityHint={t('items.shoppingMode.buttonHint')}
                />
                <Button
                  label={t('mealPlanner.menuButton')}
                  onPress={() => router.push('/meal-planner' as never)}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  accessibilityHint={t('mealPlanner.title')}
                />
                <Button
                  label={t('recipes.screenTitle')}
                  onPress={() => router.push('/recipes' as never)}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  accessibilityHint={t('recipes.screenTitle')}
                />
                <Button
                  label={t('items.pdf.button')}
                  onPress={() => void exportPdf()}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  loading={isExporting}
                  disabled={isLoading || (items?.length ?? 0) === 0}
                  accessibilityHint={t('items.pdf.buttonHint')}
                />
                <Button
                  label={t('expenses.listButton')}
                  onPress={() => router.push('/expenses')}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  accessibilityHint={t('expenses.screenTitle')}
                />
              </View>
            </View>
            <ViewersLine names={viewers} />

            {online ? (
              <RealtimeStatus status={realtimeStatus} />
            ) : (
              <OfflineBanner pendingChanges={pendingChanges} />
            )}

            <AddItemBar onAdd={(input) => addItem.mutate(input)} />

            {/* Selector de agrupación por pasillos o vista estándar */}
            {(items?.length ?? 0) > 0 && (
              <View className="flex-row items-center justify-between pt-1">
                <Text className="text-xs font-semibold uppercase tracking-wider text-muted dark:text-muted-dark">
                  {t('items.grouping.label')}
                </Text>
                <View className="flex-row items-center rounded-lg border border-line bg-surface p-0.5 dark:border-line-dark dark:bg-surface-dark">
                  <Pressable
                    onPress={() => setGroupByAisle(false)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: !groupByAisle }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 6,
                      backgroundColor: !groupByAisle ? palette.primary : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: !groupByAisle ? '#FFFFFF' : palette.textMuted,
                      }}
                    >
                      {t('items.grouping.standard')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setGroupByAisle(true)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: groupByAisle }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 6,
                      backgroundColor: groupByAisle ? palette.primary : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: groupByAisle ? '#FFFFFF' : palette.textMuted,
                      }}
                    >
                      {t('items.grouping.byAisle')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

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
