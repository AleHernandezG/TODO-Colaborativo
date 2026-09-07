import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'

import type { CatalogProduct } from '@/features/catalog'
import { CatalogSuggestions } from '@/features/catalog'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { QuantityStepper } from '@/shared/ui/QuantityStepper'
import { usePalette } from '@/theme'

import type { ItemCategory } from '../../domain/item-category'
import { getCategoryMetadata, inferItemCategory } from '../../domain/item-category'
import { isValidItemName, itemNameMaxLength, normalizeItemName } from '../../domain/item-name'
import { minQuantity } from '../../domain/quantity'
import { usePickImage } from '../hooks/use-pick-image'
import { CategoryPickerModal } from './CategoryPickerModal'
import { ItemImage } from './ItemImage'

export function AddItemBar({
  onAdd,
}: {
  onAdd: (input: {
    name: string
    quantity: number
    catalogProductId: string | null
    imageUri?: string | null
    category?: ItemCategory
  }) => void
}) {
  const { t } = useTranslation()
  const palette = usePalette()
  const pickImage = usePickImage()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(minQuantity)
  const [picked, setPicked] = useState<CatalogProduct | null>(null)
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null)
  const [manualCategory, setManualCategory] = useState<ItemCategory | null>(null)
  const [pickerVisible, setPickerVisible] = useState(false)

  const canAdd = isValidItemName(normalizeItemName(name))
  const linked = picked !== null && picked.name === name ? picked : null

  const activeCategory = manualCategory ?? (name.trim() ? inferItemCategory(name) : 'other')
  const categoryMeta = getCategoryMetadata(activeCategory)

  const handlePick = async (source: 'camera' | 'gallery') => {
    const uri = await pickImage(source)
    if (uri) {
      setPickedImageUri(uri)
    }
  }

  const submit = () => {
    if (!canAdd) {
      return
    }
    onAdd({
      name,
      quantity,
      catalogProductId: linked?.id ?? null,
      imageUri: pickedImageUri,
      category: activeCategory,
    })
    setName('')
    setPicked(null)
    setQuantity(minQuantity)
    setPickedImageUri(null)
    setManualCategory(null)
  }

  return (
    <View className="gap-3">
      <Input
        testID="add-item-name"
        label={t('items.add.label')}
        placeholder={t('items.add.placeholder')}
        value={name}
        onChangeText={setName}
        maxLength={itemNameMaxLength}
        returnKeyType="done"
        onSubmitEditing={submit}
      />

      {linked !== null ? null : (
        <CatalogSuggestions
          query={name}
          onPick={(product) => {
            setName(product.name)
            setPicked(product)
          }}
        />
      )}

      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Pressable
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t('items.categoryPicker.label', {
            category: t(categoryMeta.translationKey),
          })}
          accessibilityHint={t('items.categoryPicker.hint')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: palette.surface,
            borderWidth: 1,
            borderColor: manualCategory ? palette.primary : palette.border,
            minHeight: 40,
          }}
        >
          <Text style={{ fontSize: 16 }}>{categoryMeta.icon}</Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: manualCategory ? '600' : '500',
              color: manualCategory ? palette.primary : palette.text,
            }}
          >
            {t(categoryMeta.translationKey)}
          </Text>
          <Text style={{ fontSize: 11, color: palette.textMuted }}>▾</Text>
        </Pressable>

        {pickedImageUri ? (
          <View className="flex-row items-center gap-2">
            <ItemImage
              path={null}
              localUri={pickedImageUri}
              name={name || t('items.image.sectionLabel')}
              size={36}
            />
            <Button
              label={t('items.image.remove')}
              onPress={() => setPickedImageUri(null)}
              variant="secondary"
              size="sm"
              fullWidth={false}
              accessibilityHint={t('items.image.removeHint')}
            />
          </View>
        ) : (
          <View className="flex-row items-center gap-2">
            <Button
              label={`📷 ${t('items.image.camera')}`}
              onPress={() => void handlePick('camera')}
              variant="secondary"
              size="sm"
              fullWidth={false}
              accessibilityHint={t('items.image.cameraHint')}
            />
            <Button
              label={`🖼️ ${t('items.image.gallery')}`}
              onPress={() => void handlePick('gallery')}
              variant="secondary"
              size="sm"
              fullWidth={false}
              accessibilityHint={t('items.image.galleryHint')}
            />
          </View>
        )}
      </View>

      <CategoryPickerModal
        visible={pickerVisible}
        selectedCategory={activeCategory}
        onSelect={(cat) => setManualCategory(cat)}
        onDismiss={() => setPickerVisible(false)}
      />

      <View className="flex-row items-center gap-3">
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          decrementLabel={t('items.quantity.decrement')}
          incrementLabel={t('items.quantity.increment')}
          valueLabel={t('items.quantity.value', { count: quantity })}
        />
        <View className="flex-1">
          <Button
            label={t('items.add.submit')}
            onPress={submit}
            disabled={!canAdd}
            accessibilityHint={t('items.add.submitHint')}
          />
        </View>
      </View>
    </View>
  )
}

