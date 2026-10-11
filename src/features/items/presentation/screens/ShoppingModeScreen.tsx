import { Redirect, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, SectionList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveCommunityStore } from '@/features/community'
import { useSnackbar } from '@/shared/hooks/use-snackbar'
import { useKeepAwakeSafe } from '@/shared/lib/keep-awake'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { radius, tabularNums, usePalette } from '@/theme'

import type { Item } from '../../domain/item'
import { groupItemsByAisle } from '../../domain/item-category'
import { useItems } from '../hooks/use-items'
import { useTogglePurchased } from '../hooks/use-toggle-purchased'

type ShoppingFilter = 'pending' | 'in_cart' | 'all'

export function ShoppingModeScreen() {
  const membership = useActiveCommunityStore((state) => state.membership)

  if (!membership) {
    return <Redirect href="/" />
  }

  return <ShoppingModeView communityId={membership.community.id} communityName={membership.community.name} />
}

function ShoppingModeView({
  communityId,
  communityName,
}: {
  communityId: string
  communityName: string
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const palette = usePalette()
  const showSnackbar = useSnackbar()

  // Mantener pantalla encendida mientras se hace la compra
  useKeepAwakeSafe('shopping-mode')

  const { data: items = [], isLoading } = useItems(communityId)
  const togglePurchased = useTogglePurchased(communityId)

  const [filter, setFilter] = useState<ShoppingFilter>('pending')
  const [showFinishDialog, setShowFinishDialog] = useState(false)

  const totalCount = items.length
  const purchasedCount = items.filter((i) => i.isPurchased).length
  const pendingCount = totalCount - purchasedCount
  const progressPercent = totalCount > 0 ? Math.round((purchasedCount / totalCount) * 100) : 0

  const filteredItems = useMemo(() => {
    if (filter === 'pending') return items.filter((i) => !i.isPurchased)
    if (filter === 'in_cart') return items.filter((i) => i.isPurchased)
    return items
  }, [items, filter])

  const sections = useMemo(() => {
    const groups = groupItemsByAisle(filteredItems)
    return groups.map((g) => ({
      title: `${g.metadata.icon} ${t(g.metadata.translationKey)} (${g.items.length})`,
      data: g.items,
    }))
  }, [filteredItems, t])

  const handleFinishPurchase = () => {
    setShowFinishDialog(false)
    showSnackbar(t('shoppingMode.finishSuccess', { count: purchasedCount }))
    router.replace('/list')
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      {/* Header superior con modo compra y botón volver */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.surface,
          gap: 12,
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text style={{ fontSize: 22 }}>🛒</Text>
              <Text
                accessibilityRole="header"
                style={{ fontSize: 20, fontWeight: '700', color: palette.text }}
              >
                {t('shoppingMode.title')}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: palette.textMuted }}>{communityName}</Text>
          </View>

          <Button
            label={t('shoppingMode.exit')}
            onPress={() => router.back()}
            variant="secondary"
            size="sm"
            fullWidth={false}
            accessibilityHint={t('shoppingMode.exitHint')}
          />
        </View>

        {/* Barra de progreso visual */}
        <View className="gap-1.5">
          <View className="flex-row items-center justify-between">
            <Text style={[tabularNums, { fontSize: 13, fontWeight: '600', color: palette.text }]}>
              {t('shoppingMode.progress', {
                purchased: purchasedCount,
                total: totalCount,
                percent: progressPercent,
              })}
            </Text>
            <Text style={[tabularNums, { fontSize: 13, color: palette.primary, fontWeight: '700' }]}>
              {progressPercent}%
            </Text>
          </View>
          <View
            style={{
              height: 8,
              backgroundColor: palette.border,
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: palette.primary,
                borderRadius: 4,
              }}
            />
          </View>
        </View>

        {/* Filtros de estado */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: palette.background,
            borderRadius: radius.md,
            padding: 3,
            gap: 4,
          }}
        >
          <FilterTab
            label={t('shoppingMode.tabs.pending', { count: pendingCount })}
            active={filter === 'pending'}
            onPress={() => setFilter('pending')}
          />
          <FilterTab
            label={t('shoppingMode.tabs.inCart', { count: purchasedCount })}
            active={filter === 'in_cart'}
            onPress={() => setFilter('in_cart')}
          />
          <FilterTab
            label={t('shoppingMode.tabs.all', { count: totalCount })}
            active={filter === 'all'}
            onPress={() => setFilter('all')}
          />
        </View>
      </View>

      {/* Lista de artículos con botones grandes y táctiles (≥56pt) */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 8, flexGrow: 1 }}
        renderSectionHeader={({ section }) => (
          <View
            style={{
              paddingVertical: 8,
              paddingHorizontal: 4,
              backgroundColor: palette.background,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: palette.textMuted,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <ShoppingModeItemRow item={item} onToggle={() => togglePurchased.mutate(item)} />
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-8">
            <Text style={{ fontSize: 44, marginBottom: 8 }}>
              {filter === 'pending' && totalCount > 0 ? '🎉' : '🛒'}
            </Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: palette.text,
                textAlign: 'center',
              }}
            >
              {isLoading
                ? t('common.loading')
                : filter === 'pending' && totalCount > 0
                  ? t('shoppingMode.allPurchased')
                  : t('shoppingMode.empty')}
            </Text>
          </View>
        }
      />

      {/* Botón flotante inferior para finalizar la compra */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderTopWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.surface,
        }}
      >
        <Button
          label={t('shoppingMode.finishButton')}
          onPress={() => setShowFinishDialog(true)}
          disabled={totalCount === 0}
          accessibilityHint={t('shoppingMode.finishButtonHint')}
        />
      </View>

      {/* Diálogo de confirmación para finalizar la compra */}
      <Dialog
        visible={showFinishDialog}
        title={t('shoppingMode.finishDialog.title')}
        onDismiss={() => setShowFinishDialog(false)}
        confirmLabel={t('shoppingMode.finishDialog.confirm')}
        onConfirm={handleFinishPurchase}
        cancelLabel={t('common.cancel')}
      >
        <Text style={{ fontSize: 15, color: palette.text, lineHeight: 22 }}>
          {t('shoppingMode.finishDialog.message', {
            purchased: purchasedCount,
            total: totalCount,
          })}
        </Text>
      </Dialog>
    </SafeAreaView>
  )
}

function FilterTab({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const palette = usePalette()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        minHeight: 38,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.sm,
        backgroundColor: active ? palette.surface : 'transparent',
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: active ? '700' : '500',
          color: active ? palette.primary : palette.textMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function ShoppingModeItemRow({
  item,
  onToggle,
}: {
  item: Item
  onToggle: () => void
}) {
  const palette = usePalette()
  const { t } = useTranslation()

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.isPurchased }}
      accessibilityLabel={`${item.quantity} ${item.name}`}
      accessibilityHint={
        item.isPurchased ? t('items.row.uncheckHint') : t('items.row.checkHint')
      }
      style={{
        minHeight: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: radius.md,
        backgroundColor: item.isPurchased ? palette.surface + '66' : palette.surface,
        borderWidth: 1.5,
        borderColor: item.isPurchased ? palette.primary + '55' : palette.border,
        opacity: item.isPurchased ? 0.75 : 1,
      }}
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {/* Checkbox táctil grande */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: item.isPurchased ? palette.primary : palette.textMuted,
            backgroundColor: item.isPurchased ? palette.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {item.isPurchased && (
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>✓</Text>
          )}
        </View>

        {/* Nombre y cantidad */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: item.isPurchased ? '400' : '600',
              color: item.isPurchased ? palette.textMuted : palette.text,
              textDecorationLine: item.isPurchased ? 'line-through' : 'none',
            }}
            numberOfLines={2}
          >
            {item.name}
          </Text>
        </View>
      </View>

      {/* Cantidad destacada */}
      <View
        style={{
          minWidth: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: item.isPurchased ? palette.border : palette.primary + '18',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 8,
          marginLeft: 8,
        }}
      >
        <Text
          style={[
            tabularNums,
            {
              fontSize: 15,
              fontWeight: '700',
              color: item.isPurchased ? palette.textMuted : palette.primary,
            },
          ]}
        >
          x{item.quantity}
        </Text>
      </View>
    </Pressable>
  )
}
