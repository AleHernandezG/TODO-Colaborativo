import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Button } from '../../../../shared/ui/Button'
import { Input } from '../../../../shared/ui/Input'
import { QuantityStepper } from '../../../../shared/ui/QuantityStepper'
import type { CatalogProduct } from '../../../catalog/domain/catalog-product'
import { CatalogSuggestions } from '../../../catalog/presentation/components/CatalogSuggestions'
import { isValidItemName, itemNameMaxLength, normalizeItemName } from '../../domain/item-name'
import { minQuantity } from '../../domain/quantity'

export function AddItemBar({
  onAdd,
}: {
  onAdd: (input: { name: string; quantity: number; catalogProductId: string | null }) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(minQuantity)
  const [picked, setPicked] = useState<CatalogProduct | null>(null)
  const canAdd = isValidItemName(normalizeItemName(name))
  const linked = picked !== null && picked.name === name ? picked : null

  const submit = () => {
    if (!canAdd) {
      return
    }
    onAdd({ name, quantity, catalogProductId: linked?.id ?? null })
    setName('')
    setPicked(null)
    setQuantity(minQuantity)
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
