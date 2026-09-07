import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'

import { Dialog } from '@/shared/ui/Dialog'
import { radius, usePalette } from '@/theme'

import type { ItemCategory } from '../../domain/item-category'
import { ITEM_CATEGORIES } from '../../domain/item-category'

type CategoryPickerModalProps = {
  visible: boolean
  selectedCategory: ItemCategory
  onSelect: (category: ItemCategory) => void
  onDismiss: () => void
}

export function CategoryPickerModal({
  visible,
  selectedCategory,
  onSelect,
  onDismiss,
}: CategoryPickerModalProps) {
  const { t } = useTranslation()
  const palette = usePalette()

  return (
    <Dialog
      visible={visible}
      title={t('items.categoryPicker.title')}
      onDismiss={onDismiss}
      confirmLabel={t('common.close')}
      onConfirm={onDismiss}
      cancelLabel={t('common.cancel')}
    >
      <View className="gap-2">
        {ITEM_CATEGORIES.map((cat) => {
          const isSelected = cat.id === selectedCategory
          return (
            <Pressable
              key={cat.id}
              onPress={() => {
                onSelect(cat.id)
                onDismiss()
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t(cat.translationKey)}
              style={{
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: radius.md,
                backgroundColor: isSelected ? palette.primary + '18' : 'transparent',
                borderWidth: 1,
                borderColor: isSelected ? palette.primary : palette.border,
              }}
            >
              <View className="flex-row items-center gap-3">
                <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: isSelected ? '600' : '400',
                    color: isSelected ? palette.primary : palette.text,
                  }}
                >
                  {t(cat.translationKey)}
                </Text>
              </View>
              {isSelected && (
                <Text style={{ color: palette.primary, fontSize: 16, fontWeight: '700' }}>✓</Text>
              )}
            </Pressable>
          )
        })}
      </View>
    </Dialog>
  )
}
