import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'

import { Checkbox } from '../../../../shared/ui/Checkbox'
import { minTouchTarget } from '../../../../theme'
import type { Item } from '../../domain/item'
import { ItemImage } from './ItemImage'

type ItemRowProps = {
  item: Item
  uploadingImage: boolean
  catalogImageUrl: string | null
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}

const appear = FadeIn.duration(180)
const reflow = LinearTransition.duration(180)

export function ItemRow({
  item,
  uploadingImage,
  catalogImageUrl,
  onToggle,
  onEdit,
  onDelete,
}: ItemRowProps) {
  const { t } = useTranslation()
  const showsImage = uploadingImage || item.imagePath !== null || catalogImageUrl !== null

  return (
    <Animated.View entering={appear} layout={reflow}>
      <View
        style={{ minHeight: minTouchTarget }}
        className="flex-row items-center gap-2 rounded-md bg-surface px-2 py-1 dark:bg-surface-dark"
      >
        <Checkbox
          checked={item.isPurchased}
          onToggle={onToggle}
          accessibilityLabel={
            item.isPurchased
              ? t('items.markPending', { name: item.name })
              : t('items.markPurchased', { name: item.name })
          }
        />

        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={t('items.edit.open', { name: item.name, count: item.quantity })}
          accessibilityHint={t('items.edit.openHint')}
          style={{ minHeight: minTouchTarget }}
          className="flex-1 flex-row items-center gap-2 active:opacity-70"
        >
          {showsImage ? (
            <ItemImage
              path={item.imagePath}
              catalogUrl={catalogImageUrl}
              name={item.name}
              size={36}
              uploading={uploadingImage}
              decorative
            />
          ) : null}

          <Text
            className={`flex-1 text-lg ${
              item.isPurchased
                ? 'text-muted line-through dark:text-muted-dark'
                : 'text-content dark:text-content-dark'
            }`}
          >
            {item.name}
          </Text>

          {item.quantity > 1 ? (
            <Text className="text-base font-medium text-muted dark:text-muted-dark">
              ×{item.quantity}
            </Text>
          ) : null}
        </Pressable>

        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={t('items.delete', { name: item.name })}
          hitSlop={8}
          style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}
          className="items-center justify-center active:opacity-70"
        >
          <Text className="text-xl text-muted dark:text-muted-dark">✕</Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}
