import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'

import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { Input } from '@/shared/ui/Input'
import { QuantityStepper } from '@/shared/ui/QuantityStepper'
import { usePalette } from '@/theme'

import type { ItemImageChange } from '../../domain/edit-item'
import type { Item } from '../../domain/item'
import type { ItemCategory } from '../../domain/item-category'
import { getCategoryMetadata } from '../../domain/item-category'
import { isValidItemName, itemNameMaxLength, normalizeItemName } from '../../domain/item-name'
import { usePickImage } from '../hooks/use-pick-image'
import { CategoryPickerModal } from './CategoryPickerModal'
import { ItemImage } from './ItemImage'

type EditItemDialogProps = {
  item: Item | null
  catalogImageUrl: string | null
  onDismiss: () => void
  onSave: (input: {
    itemId: string
    name: string
    quantity: number
    image: ItemImageChange
    currentImagePath: string | null
    category: ItemCategory
  }) => void
}

const keepImage: ItemImageChange = { kind: 'keep' }

export function EditItemDialog({ item, catalogImageUrl, onDismiss, onSave }: EditItemDialogProps) {
  const { t } = useTranslation()
  const palette = usePalette()
  const pickImage = usePickImage()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [image, setImage] = useState<ItemImageChange>(keepImage)
  const [category, setCategory] = useState<ItemCategory>('other')
  const [pickerVisible, setPickerVisible] = useState(false)

  useEffect(() => {
    if (item) {
      setName(item.name)
      setQuantity(item.quantity)
      setImage(keepImage)
      setCategory(item.category ?? 'other')
    }
  }, [item])

  const canSave = isValidItemName(normalizeItemName(name))
  const previewPath = image.kind === 'clear' ? null : (item?.imagePath ?? null)
  const previewLocalUri = image.kind === 'replace' ? image.uri : null
  const hasImage = previewPath !== null || previewLocalUri !== null
  const categoryMeta = getCategoryMetadata(category)

  const pick = async (source: 'camera' | 'gallery') => {
    const uri = await pickImage(source)
    if (uri) {
      setImage({ kind: 'replace', uri })
    }
  }

  const save = () => {
    if (!item || !canSave) {
      return
    }
    onSave({
      itemId: item.id,
      name,
      quantity,
      image,
      currentImagePath: item.imagePath,
      category,
    })
    onDismiss()
  }

  return (
    <>
      <Dialog
        visible={item !== null}
        title={t('items.edit.title')}
        onDismiss={onDismiss}
        confirmLabel={t('items.edit.submit')}
        onConfirm={save}
        confirmDisabled={!canSave}
        cancelLabel={t('common.cancel')}
      >
        <View className="gap-4">
          <Input
            label={t('items.edit.nameLabel')}
            value={name}
            onChangeText={setName}
            maxLength={itemNameMaxLength}
            returnKeyType="done"
            onSubmitEditing={save}
          />

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-muted dark:text-muted-dark">
              {t('items.edit.categoryLabel')}
            </Text>
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
                justifyContent: 'space-between',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: palette.surface,
                borderWidth: 1,
                borderColor: palette.border,
                minHeight: 48,
              }}
            >
              <View className="flex-row items-center gap-2.5">
                <Text style={{ fontSize: 20 }}>{categoryMeta.icon}</Text>
                <Text style={{ fontSize: 15, color: palette.text }}>
                  {t(categoryMeta.translationKey)}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: palette.textMuted }}>▾</Text>
            </Pressable>
          </View>

          <QuantityStepper
            value={quantity}
            onChange={setQuantity}
            decrementLabel={t('items.quantity.decrement')}
            incrementLabel={t('items.quantity.increment')}
            valueLabel={t('items.quantity.value', { count: quantity })}
          />

          <View className="gap-2">
            <Text className="text-sm font-medium text-muted dark:text-muted-dark">
              {t('items.image.sectionLabel')}
            </Text>

            <View className="flex-row items-center gap-3">
              <ItemImage
                path={previewPath}
                localUri={previewLocalUri}
                catalogUrl={catalogImageUrl}
                name={name || t('items.image.sectionLabel')}
                size={96}
              />
              <View className="flex-1 gap-2">
                <Button
                  label={t('items.image.camera')}
                  onPress={() => void pick('camera')}
                  variant="secondary"
                  size="sm"
                  accessibilityHint={t('items.image.cameraHint')}
                />
                <Button
                  label={t('items.image.gallery')}
                  onPress={() => void pick('gallery')}
                  variant="secondary"
                  size="sm"
                  accessibilityHint={t('items.image.galleryHint')}
                />
              </View>
            </View>

            {hasImage ? (
              <Button
                label={t('items.image.remove')}
                onPress={() => setImage({ kind: 'clear' })}
                variant="secondary"
                size="sm"
                accessibilityHint={t('items.image.removeHint')}
              />
            ) : null}
          </View>
        </View>
      </Dialog>

      <CategoryPickerModal
        visible={pickerVisible}
        selectedCategory={category}
        onSelect={(cat) => setCategory(cat)}
        onDismiss={() => setPickerVisible(false)}
      />
    </>
  )
}
