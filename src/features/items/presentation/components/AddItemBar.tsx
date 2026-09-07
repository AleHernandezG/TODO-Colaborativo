import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import type { CatalogProduct } from '@/features/catalog'
import { CatalogSuggestions } from '@/features/catalog'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { QuantityStepper } from '@/shared/ui/QuantityStepper'

import { isValidItemName, itemNameMaxLength, normalizeItemName } from '../../domain/item-name'
import { minQuantity } from '../../domain/quantity'
import { usePickImage } from '../hooks/use-pick-image'
import { ItemImage } from './ItemImage'

export function AddItemBar({
  onAdd,
}: {
  onAdd: (input: {
    name: string
    quantity: number
    catalogProductId: string | null
    imageUri?: string | null
  }) => void
}) {
  const { t } = useTranslation()
  const pickImage = usePickImage()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(minQuantity)
  const [picked, setPicked] = useState<CatalogProduct | null>(null)
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null)

  const canAdd = isValidItemName(normalizeItemName(name))
  const linked = picked !== null && picked.name === name ? picked : null

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
    })
    setName('')
    setPicked(null)
    setQuantity(minQuantity)
    setPickedImageUri(null)
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

      {pickedImageUri ? (
        <View className="flex-row items-center justify-between rounded-xl border border-line bg-surface p-2.5 dark:border-line-dark dark:bg-surface-dark">
          <View className="flex-row items-center gap-3">
            <ItemImage
              path={null}
              localUri={pickedImageUri}
              name={name || t('items.image.sectionLabel')}
              size={48}
            />
            <Text className="text-sm font-medium text-content dark:text-content-dark">
              {t('items.image.attached')}
            </Text>
          </View>
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
