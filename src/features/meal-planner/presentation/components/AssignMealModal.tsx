import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'

import { Recipe } from '@/features/recipes'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { Input } from '@/shared/ui/Input'
import { QuantityStepper } from '@/shared/ui/QuantityStepper'
import { usePalette } from '@/theme'

import type { MealPlanSlotWithRecipe, MealType } from '../../domain/meal-plan'

type AssignMealModalProps = {
  visible: boolean
  onDismiss: () => void
  onSave: (payload: {
    recipeId: string | null
    customDishName: string | null
    servings: number
    notes: string | null
  }) => void
  onDelete?: () => void
  mealType: MealType
  dateStr: string
  slot: MealPlanSlotWithRecipe | null
  availableRecipes: Recipe[]
}

export function AssignMealModal({
  visible,
  onDismiss,
  onSave,
  onDelete,
  mealType,
  slot,
  availableRecipes,
}: AssignMealModalProps) {
  const { t } = useTranslation()
  const palette = usePalette()

  const [mode, setMode] = useState<'recipe' | 'custom'>('recipe')
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [customDishName, setCustomDishName] = useState('')
  const [servings, setServings] = useState(4)
  const [notes, setNotes] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (visible) {
      if (slot?.recipeId) {
        setMode('recipe')
        setSelectedRecipeId(slot.recipeId)
        setCustomDishName('')
        setServings(slot.servings || 4)
        setNotes(slot.notes ?? '')
      } else if (slot?.customDishName) {
        setMode('custom')
        setSelectedRecipeId(null)
        setCustomDishName(slot.customDishName)
        setServings(slot.servings || 4)
        setNotes(slot.notes ?? '')
      } else {
        setMode('recipe')
        setSelectedRecipeId(null)
        setCustomDishName('')
        setServings(4)
        setNotes('')
      }
      setSearchQuery('')
    }
  }, [visible, slot])

  const filteredRecipes = availableRecipes.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  )

  const handleSelectRecipe = (r: Recipe) => {
    setSelectedRecipeId(r.id)
    if (!slot?.servings) {
      setServings(r.servings || 4)
    }
  }

  const canSave =
    mode === 'recipe' ? Boolean(selectedRecipeId) : customDishName.trim().length > 0

  const handleConfirm = () => {
    if (!canSave) return
    onSave({
      recipeId: mode === 'recipe' ? selectedRecipeId : null,
      customDishName: mode === 'custom' ? customDishName.trim() : null,
      servings,
      notes: notes.trim() ? notes.trim() : null,
    })
    onDismiss()
  }

  const mealTypeName =
    mealType === 'lunch'
      ? t('mealPlanner.mealTypes.lunch')
      : t('mealPlanner.mealTypes.dinner')

  return (
    <Dialog
      visible={visible}
      title={`${t('mealPlanner.assignTitle')} · ${mealTypeName}`}
      onDismiss={onDismiss}
      confirmLabel={t('common.save', { defaultValue: 'Guardar' })}
      cancelLabel={t('common.cancel', { defaultValue: 'Cancelar' })}
      onConfirm={handleConfirm}
      confirmDisabled={!canSave}
    >
      <View className="gap-4">
        {/* Selector de modo: Receta vs Plato libre */}
        <View className="flex-row rounded-lg p-1" style={{ backgroundColor: palette.background }}>
          <TouchableOpacity
            onPress={() => setMode('recipe')}
            className="flex-1 py-2 items-center rounded-md"
            style={{
              backgroundColor: mode === 'recipe' ? palette.primary : 'transparent',
            }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: mode === 'recipe' ? '#FFFFFF' : palette.textMuted }}
            >
              {t('mealPlanner.modes.recipe')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode('custom')}
            className="flex-1 py-2 items-center rounded-md"
            style={{
              backgroundColor: mode === 'custom' ? palette.primary : 'transparent',
            }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: mode === 'custom' ? '#FFFFFF' : palette.textMuted }}
            >
              {t('mealPlanner.modes.custom')}
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'recipe' ? (
          <View className="gap-2">
            <Input
              label={t('mealPlanner.searchRecipesPlaceholder')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('mealPlanner.searchRecipesPlaceholder')}
              autoCapitalize="none"
            />

            <View
              className="rounded-lg border max-h-48 overflow-hidden"
              style={{ borderColor: palette.border, backgroundColor: palette.surface }}
            >
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {filteredRecipes.length === 0 ? (
                  <View className="p-4 items-center">
                    <Text className="text-xs" style={{ color: palette.textMuted }}>
                      {t('mealPlanner.noRecipesFound')}
                    </Text>
                  </View>
                ) : (
                  filteredRecipes.map((r) => {
                    const isSelected = selectedRecipeId === r.id
                    return (
                      <TouchableOpacity
                        key={r.id}
                        onPress={() => handleSelectRecipe(r)}
                        className="p-3 border-b flex-row justify-between items-center"
                        style={{
                          borderColor: palette.border,
                          backgroundColor: isSelected ? `${palette.primary}15` : 'transparent',
                        }}
                      >
                        <View className="flex-1 mr-2">
                          <Text
                            className="font-medium text-sm"
                            style={{
                              color: isSelected ? palette.primary : palette.text,
                            }}
                          >
                            {r.title}
                          </Text>
                          <Text className="text-xs" style={{ color: palette.textMuted }}>
                            {r.ingredients.length} {t('mealPlanner.ingredientsCount')} · {r.servings}{' '}
                            {t('mealPlanner.servings')}
                          </Text>
                        </View>
                        {isSelected && (
                          <Text className="font-bold text-base" style={{ color: palette.primary }}>
                            ✓
                          </Text>
                        )}
                      </TouchableOpacity>
                    )
                  })
                )}
              </ScrollView>
            </View>
          </View>
        ) : (
          <View className="gap-2">
            <Input
              label={t('mealPlanner.customDishLabel')}
              value={customDishName}
              onChangeText={setCustomDishName}
              placeholder={t('mealPlanner.customDishPlaceholder')}
            />
          </View>
        )}

        {/* Comensales / Raciones */}
        <View className="flex-row items-center justify-between pt-2">
          <View>
            <Text className="text-sm font-semibold" style={{ color: palette.text }}>
              {t('mealPlanner.servings')}
            </Text>
            <Text className="text-xs" style={{ color: palette.textMuted }}>
              {t('mealPlanner.servingsHint')}
            </Text>
          </View>
          <QuantityStepper
            value={servings}
            onChange={setServings}
            min={1}
            decrementLabel={t('mealPlanner.servings')}
            incrementLabel={t('mealPlanner.servings')}
            valueLabel={`${servings} ${t('mealPlanner.servingsShort')}`}
          />
        </View>

        {/* Notas adicionales */}
        <Input
          label={t('mealPlanner.notesLabel')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('mealPlanner.notesPlaceholder')}
        />

        {/* Si ya existe un plato asignado, opción de vaciar */}
        {slot && onDelete && (
          <View className="pt-2">
            <Button
              label={t('mealPlanner.clearSlot')}
              onPress={() => {
                onDelete()
                onDismiss()
              }}
              variant="danger"
              size="sm"
            />
          </View>
        )}
      </View>
    </Dialog>
  )
}
