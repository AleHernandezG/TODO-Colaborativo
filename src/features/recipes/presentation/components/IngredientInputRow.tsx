import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, TextInput, View } from 'react-native'

import type { CatalogProduct } from '@/features/catalog'
import { CatalogSuggestions } from '@/features/catalog'
import { minTouchTarget, usePalette } from '@/theme'

import type { NewRecipeIngredientInput } from '../../domain/recipe'

type Props = {
  ingredient: NewRecipeIngredientInput
  onChange: (updated: NewRecipeIngredientInput) => void
  onRemove: () => void
  canRemove: boolean
}

export function IngredientInputRow({ ingredient, onChange, onRemove, canRemove }: Props) {
  const { t } = useTranslation()
  const palette = usePalette()
  const [showSuggestions, setShowSuggestions] = useState(false)

  const handlePickProduct = (product: CatalogProduct) => {
    onChange({
      ...ingredient,
      name: product.name,
      catalogProductId: product.id,
    })
    setShowSuggestions(false)
  }

  const handleNameChange = (text: string) => {
    onChange({
      ...ingredient,
      name: text,
      catalogProductId: ingredient.catalogProductId ? null : ingredient.catalogProductId,
    })
    setShowSuggestions(text.trim().length >= 2)
  }

  return (
    <View className="gap-2 rounded-lg border border-line bg-surface p-3 dark:border-line-dark dark:bg-surface-dark">
      <View className="flex-row items-end gap-2">
        {/* Cantidad */}
        <View className="w-16 gap-1">
          <Text className="text-xs font-medium text-muted dark:text-muted-dark">
            {t('recipes.ingredients.quantity')}
          </Text>
          <TextInput
            value={ingredient.quantity ? String(ingredient.quantity) : ''}
            onChangeText={(text) => {
              const cleaned = text.replace(',', '.')
              const val = parseFloat(cleaned)
              onChange({ ...ingredient, quantity: isNaN(val) ? 0 : val })
            }}
            placeholder="1"
            placeholderTextColor={palette.textMuted}
            keyboardType="decimal-pad"
            style={{ minHeight: 44, color: palette.text }}
            className="rounded-md border border-line bg-background px-2 py-1.5 text-base dark:border-line-dark dark:bg-background-dark"
          />
        </View>

        {/* Unidad */}
        <View className="w-20 gap-1">
          <Text className="text-xs font-medium text-muted dark:text-muted-dark">
            {t('recipes.ingredients.unit')}
          </Text>
          <TextInput
            value={ingredient.unit ?? ''}
            onChangeText={(text) => onChange({ ...ingredient, unit: text.trim() || null })}
            placeholder={t('recipes.ingredients.unitPlaceholder')}
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            style={{ minHeight: 44, color: palette.text }}
            className="rounded-md border border-line bg-background px-2 py-1.5 text-base dark:border-line-dark dark:bg-background-dark"
          />
        </View>

        {/* Nombre */}
        <View className="flex-1 gap-1">
          <Text className="text-xs font-medium text-muted dark:text-muted-dark">
            {t('recipes.ingredients.name')}
          </Text>
          <TextInput
            value={ingredient.name}
            onChangeText={handleNameChange}
            placeholder={t('recipes.ingredients.namePlaceholder')}
            placeholderTextColor={palette.textMuted}
            style={{ minHeight: 44, color: palette.text }}
            className="rounded-md border border-line bg-background px-2 py-1.5 text-base dark:border-line-dark dark:bg-background-dark"
          />
        </View>

        {/* Botón eliminar */}
        {canRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('recipes.ingredients.remove')}
            onPress={onRemove}
            style={{ minHeight: minTouchTarget, minWidth: minTouchTarget }}
            className="items-center justify-center"
          >
            <Text className="text-lg font-bold text-danger dark:text-danger-dark">✕</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Indicador de catálogo */}
      {ingredient.catalogProductId ? (
        <View className="flex-row items-center gap-1.5 pt-1">
          <Text className="text-xs font-medium text-primary dark:text-primary-dark">
            🛒 {t('recipes.ingredients.linkedToCatalog')}
          </Text>
        </View>
      ) : null}

      {/* Sugerencias del catálogo */}
      {showSuggestions && !ingredient.catalogProductId && ingredient.name.trim().length >= 2 ? (
        <View className="mt-1">
          <CatalogSuggestions query={ingredient.name} onPick={handlePickProduct} />
        </View>
      ) : null}
    </View>
  )
}
