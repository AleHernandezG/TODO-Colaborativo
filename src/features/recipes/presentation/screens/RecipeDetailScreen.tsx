import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveCommunityStore } from '@/features/community'
import { Button } from '@/shared/ui/Button'
import { QuantityStepper } from '@/shared/ui/QuantityStepper'
import { minTouchTarget } from '@/theme'

import { formatIngredientDisplay, scaleIngredientQuantity } from '../../domain/recipe'
import { useAddRecipeToList } from '../hooks/use-add-recipe-to-list'
import { useDeleteRecipe } from '../hooks/use-delete-recipe'
import { useRecipe } from '../hooks/use-recipes'

export function RecipeDetailScreen({ recipeId }: { recipeId: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const membership = useActiveCommunityStore((state) => state.membership)
  const communityId = membership?.community.id ?? ''

  const { data: recipe, isLoading, isError } = useRecipe(recipeId)
  const deleteRecipeMutation = useDeleteRecipe(communityId)
  const addToListMutation = useAddRecipeToList(communityId)

  const [targetServings, setTargetServings] = useState<number>(4)
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (recipe) {
      setTargetServings(recipe.servings)
      setSelectedIngredientIds(new Set(recipe.ingredients.map((ing) => ing.id)))
    }
  }, [recipe])

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <Text className="text-base text-muted dark:text-muted-dark">{t('recipes.loading')}</Text>
      </SafeAreaView>
    )
  }

  if (isError || !recipe) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-background p-6 dark:bg-background-dark">
        <Text className="text-lg font-bold text-content dark:text-content-dark">
          {t('recipes.notFound')}
        </Text>
        <Button label={t('common.cancel')} onPress={() => router.back()} fullWidth={false} />
      </SafeAreaView>
    )
  }

  const toggleIngredient = (id: string) => {
    setSelectedIngredientIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIngredientIds.size === recipe.ingredients.length) {
      setSelectedIngredientIds(new Set())
    } else {
      setSelectedIngredientIds(new Set(recipe.ingredients.map((i) => i.id)))
    }
  }

  const handleDelete = () => {
    Alert.alert(t('recipes.deleteConfirmTitle'), t('recipes.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('recipes.deleteButton'),
        style: 'destructive',
        onPress: async () => {
          await deleteRecipeMutation.mutateAsync(recipe.id)
          router.replace('/recipes' as never)
        },
      },
    ])
  }

  const handleAddToList = async () => {
    const itemsToAdd = recipe.ingredients
      .filter((ing) => selectedIngredientIds.has(ing.id))
      .map((ing) => {
        const scaledQty = scaleIngredientQuantity(
          ing.quantity,
          recipe.servings,
          targetServings,
        )
        const unitSuffix = ing.unit ? ` (${ing.unit})` : ''
        return {
          name: `${ing.name}${unitSuffix}`,
          quantity: Math.max(1, Math.round(scaledQty)),
          catalogProductId: ing.catalogProductId,
        }
      })

    if (itemsToAdd.length === 0) return

    try {
      await addToListMutation.mutateAsync({
        recipeTitle: recipe.title,
        items: itemsToAdd,
      })
      router.push('/list')
    } catch {
      // Error manejado en el hook
    }
  }

  const selectedCount = selectedIngredientIds.size

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-1">
        {/* Cabecera */}
        <View className="flex-row items-center justify-between border-b border-line px-4 py-3 dark:border-line-dark">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            onPress={() => router.back()}
            style={{ minHeight: minTouchTarget, minWidth: minTouchTarget }}
            className="items-center justify-center"
          >
            <Text className="text-base text-primary dark:text-primary-dark">
              ‹ {t('recipes.screenTitle')}
            </Text>
          </Pressable>

          <View className="flex-row items-center gap-2">
            <Button
              label={t('recipes.editButton')}
              onPress={() => router.push(`/recipes/edit?id=${recipe.id}` as never)}
              variant="secondary"
              size="sm"
              fullWidth={false}
            />
            <Button
              label={t('recipes.deleteButton')}
              onPress={handleDelete}
              variant="danger"
              size="sm"
              fullWidth={false}
              loading={deleteRecipeMutation.isPending}
            />
          </View>
        </View>

        <ScrollView
          className="flex-1 px-4 py-4"
          contentContainerStyle={{ gap: 20, paddingBottom: 60 }}
        >
          {/* Título */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-content dark:text-content-dark">
              {recipe.title}
            </Text>
          </View>

          {/* Selector interactivo de comensales */}
          <View className="rounded-xl border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark gap-2">
            <Text className="text-sm font-semibold text-muted dark:text-muted-dark uppercase">
              {t('recipes.servingsAdjustLabel')}
            </Text>
            <View className="flex-row items-center justify-between">
              <View className="gap-0.5">
                <Text className="text-lg font-bold text-content dark:text-content-dark">
                  🍽️ {t('recipes.servingsCount', { count: targetServings })}
                </Text>
                {targetServings !== recipe.servings ? (
                  <Text className="text-xs text-primary dark:text-primary-dark">
                    {t('recipes.scaledFromOriginal', { count: recipe.servings })}
                  </Text>
                ) : null}
              </View>

              <QuantityStepper
                value={targetServings}
                onChange={setTargetServings}
                min={1}
                decrementLabel={t('recipes.servingsDecrement')}
                incrementLabel={t('recipes.servingsIncrement')}
                valueLabel={t('recipes.servingsCount', { count: targetServings })}
              />
            </View>
          </View>

          {/* Ingredientes */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-content dark:text-content-dark">
                🥕 {t('recipes.ingredientsLabel')} ({recipe.ingredients.length})
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={toggleAll}
                style={{ minHeight: minTouchTarget }}
                className="justify-center"
              >
                <Text className="text-sm font-medium text-primary dark:text-primary-dark">
                  {selectedIngredientIds.size === recipe.ingredients.length
                    ? t('recipes.unselectAll')
                    : t('recipes.selectAll')}
                </Text>
              </Pressable>
            </View>

            <View className="gap-2">
              {recipe.ingredients.map((ing) => {
                const isSelected = selectedIngredientIds.has(ing.id)
                const scaledQuantity = scaleIngredientQuantity(
                  ing.quantity,
                  recipe.servings,
                  targetServings,
                )
                const displayText = formatIngredientDisplay({
                  name: ing.name,
                  quantity: scaledQuantity,
                  unit: ing.unit,
                })

                return (
                  <Pressable
                    key={ing.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    onPress={() => toggleIngredient(ing.id)}
                    style={{ minHeight: minTouchTarget }}
                    className={`flex-row items-center justify-between rounded-lg border p-3 ${
                      isSelected
                        ? 'border-primary/50 bg-surface dark:border-primary-dark/50 dark:bg-surface-dark'
                        : 'border-line bg-background/50 opacity-60 dark:border-line-dark dark:bg-background-dark/50'
                    }`}
                  >
                    <View className="flex-row items-center gap-3 flex-1">
                      <Text className="text-lg">{isSelected ? '☑️' : '⬜'}</Text>
                      <View className="gap-0.5 flex-1">
                        <Text
                          className={`text-base font-medium ${
                            isSelected
                              ? 'text-content dark:text-content-dark'
                              : 'text-muted line-through dark:text-muted-dark'
                          }`}
                        >
                          {displayText}
                        </Text>
                        {ing.catalogProductId ? (
                          <Text className="text-xs text-primary dark:text-primary-dark">
                            🛒 {t('recipes.ingredients.linkedToCatalog')}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* Botón de acción destacado */}
          <View className="mt-2">
            <Button
              label={t('recipes.addSelectedToList', { count: selectedCount })}
              onPress={() => void handleAddToList()}
              disabled={selectedCount === 0}
              loading={addToListMutation.isPending}
            />
          </View>

          {/* Instrucciones de preparación */}
          {recipe.instructions.trim() ? (
            <View className="gap-2 rounded-xl border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
              <Text className="text-lg font-bold text-content dark:text-content-dark">
                📝 {t('recipes.instructionsLabel')}
              </Text>
              <Text className="text-base leading-relaxed text-content dark:text-content-dark">
                {recipe.instructions}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}
