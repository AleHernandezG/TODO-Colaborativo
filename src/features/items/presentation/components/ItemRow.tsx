import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'

import { Checkbox } from '../../../../shared/ui/Checkbox'
import { minTouchTarget } from '../../../../theme'
import type { Item } from '../../domain/item'

type ItemRowProps = {
  item: Item
  onToggle: () => void
  onDelete: () => void
}

export function ItemRow({ item, onToggle, onDelete }: ItemRowProps) {
  const { t } = useTranslation()

  return (
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
  )
}
