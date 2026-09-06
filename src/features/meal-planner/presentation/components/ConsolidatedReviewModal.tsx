import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'

import { Checkbox } from '@/shared/ui/Checkbox'
import { Dialog } from '@/shared/ui/Dialog'
import { usePalette } from '@/theme'

import type { ConsolidatedIngredient } from '../../domain/meal-plan'

type ConsolidatedReviewModalProps = {
  visible: boolean
  onDismiss: () => void
  onConfirm: (selectedIngredients: ConsolidatedIngredient[]) => void
  ingredients: ConsolidatedIngredient[]
  isSubmitting?: boolean
}

export function ConsolidatedReviewModal({
  visible,
  onDismiss,
  onConfirm,
  ingredients,
  isSubmitting = false,
}: ConsolidatedReviewModalProps) {
  const { t } = useTranslation()
  const palette = usePalette()

  // Track checked state by index
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (visible) {
      // By default select all
      setSelectedIndices(new Set(ingredients.map((_, i) => i)))
    }
  }, [visible, ingredients])

  const toggleIndex = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIndices.size === ingredients.length) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(ingredients.map((_, i) => i)))
    }
  }

  const handleConfirm = () => {
    const selected = ingredients.filter((_, i) => selectedIndices.has(i))
    onConfirm(selected)
  }

  const selectedCount = selectedIndices.size

  return (
    <Dialog
      visible={visible}
      title={t('mealPlanner.consolidatedModal.title')}
      onDismiss={onDismiss}
      confirmLabel={
        isSubmitting
          ? t('common.loading', { defaultValue: 'Añadiendo...' })
          : t('mealPlanner.consolidatedModal.addCount', { count: selectedCount })
      }
      cancelLabel={t('common.cancel', { defaultValue: 'Cancelar' })}
      onConfirm={handleConfirm}
      confirmDisabled={selectedCount === 0 || isSubmitting}
    >
      <View className="gap-3">
        <Text className="text-xs" style={{ color: palette.textMuted }}>
          {t('mealPlanner.consolidatedModal.hint')}
        </Text>

        <TouchableOpacity onPress={toggleAll} className="self-start py-1">
          <Text className="text-xs font-semibold" style={{ color: palette.primary }}>
            {selectedIndices.size === ingredients.length
              ? t('mealPlanner.consolidatedModal.unselectAll')
              : t('mealPlanner.consolidatedModal.selectAll')}
          </Text>
        </TouchableOpacity>

        <View
          className="rounded-lg border max-h-80 overflow-hidden"
          style={{ borderColor: palette.border, backgroundColor: palette.surface }}
        >
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {ingredients.length === 0 ? (
              <View className="p-4 items-center">
                <Text className="text-xs" style={{ color: palette.textMuted }}>
                  {t('mealPlanner.consolidatedModal.empty')}
                </Text>
              </View>
            ) : (
              ingredients.map((ing, idx) => {
                const isChecked = selectedIndices.has(idx)
                const quantityStr = Number.isInteger(ing.quantity)
                  ? String(ing.quantity)
                  : ing.quantity.toFixed(2).replace(/\.?0+$/, '')
                const unitStr = ing.unit ? ` ${ing.unit}` : ''

                return (
                  <TouchableOpacity
                    key={`${ing.name}-${idx}`}
                    onPress={() => toggleIndex(idx)}
                    className="p-3 border-b flex-row items-center gap-3"
                    style={{
                      borderColor: palette.border,
                      backgroundColor: isChecked ? 'transparent' : `${palette.border}15`,
                    }}
                  >
                    <Checkbox
                      checked={isChecked}
                      onToggle={() => toggleIndex(idx)}
                      accessibilityLabel={ing.name}
                    />

                    <View className="flex-1">
                      <View className="flex-row items-center justify-between">
                        <Text
                          className="font-medium text-sm"
                          style={{
                            color: isChecked ? palette.text : palette.textMuted,
                            textDecorationLine: isChecked ? 'none' : 'line-through',
                          }}
                        >
                          {ing.name}
                        </Text>
                        <Text
                          className="font-semibold text-xs"
                          style={{
                            color: isChecked ? palette.primary : palette.textMuted,
                          }}
                        >
                          {quantityStr}
                          {unitStr}
                        </Text>
                      </View>

                      {ing.recipeSources.length > 0 && (
                        <Text
                          className="text-xs mt-0.5"
                          style={{ color: palette.textMuted }}
                          numberOfLines={1}
                        >
                          {ing.recipeSources.join(', ')}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Dialog>
  )
}
