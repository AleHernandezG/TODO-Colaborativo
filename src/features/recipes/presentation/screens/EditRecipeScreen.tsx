import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveCommunityStore } from '@/features/community'
import { usePickImage } from '@/shared/hooks/use-pick-image'
import { randomUuid } from '@/shared/lib/uuid'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { QuantityStepper } from '@/shared/ui/QuantityStepper'
import { minTouchTarget, usePalette } from '@/theme'

import { supabaseRecipeRepository } from '../../data/supabase-recipe-repository'
import {
  defaultServings,
  isValidRecipeTitle,
  type NewRecipeIngredientInput,
  type NewRecipeInput,
  type RecipeImageChange,
} from '../../domain/recipe'
import { IngredientInputRow } from '../components/IngredientInputRow'
import { RecipeImage } from '../components/RecipeImage'
import { useRecipe } from '../hooks/use-recipes'
import { useSaveRecipe } from '../hooks/use-save-recipe'

export function EditRecipeScreen({ recipeId }: { recipeId?: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const palette = usePalette()
  const membership = useActiveCommunityStore((state) => state.membership)
  const communityId = membership?.community.id ?? ''
  const pickImage = usePickImage()

  const isEditing = Boolean(recipeId)
  const { data: existingRecipe, isLoading: isLoadingRecipe } = useRecipe(recipeId ?? '')
  const saveRecipeMutation = useSaveRecipe(communityId)

  const [title, setTitle] = useState('')
  const [servings, setServings] = useState(defaultServings)
  const [instructions, setInstructions] = useState('')
  const [imageChange, setImageChange] = useState<RecipeImageChange>({ kind: 'keep' })
  const [ingredients, setIngredients] = useState<NewRecipeIngredientInput[]>([
    { name: '', quantity: 1, unit: null },
  ])

  useEffect(() => {
    if (existingRecipe) {
      setTitle(existingRecipe.title)
      setServings(existingRecipe.servings)
      setInstructions(existingRecipe.instructions)
      setImageChange({ kind: 'keep' })
      setIngredients(
        existingRecipe.ingredients.length > 0
          ? existingRecipe.ingredients.map((ing) => ({
              id: ing.id,
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
              catalogProductId: ing.catalogProductId,
              sortOrder: ing.sortOrder,
            }))
          : [{ name: '', quantity: 1, unit: null }],
      )
    }
  }, [existingRecipe])

  const canSave =
    isValidRecipeTitle(title) &&
    ingredients.length > 0 &&
    ingredients.some((ing) => ing.name.trim().length > 0) &&
    !saveRecipeMutation.isPending

  const previewPath = imageChange.kind === 'clear' ? null : (existingRecipe?.imagePath ?? null)
  const previewLocalUri = imageChange.kind === 'replace' ? imageChange.uri : null
  const hasCoverImage = previewPath !== null || previewLocalUri !== null

  const handlePickCover = async (source: 'camera' | 'gallery') => {
    const uri = await pickImage(source)
    if (uri) {
      setImageChange({ kind: 'replace', uri })
    }
  }

  const handleAddIngredient = () => {
    setIngredients((prev) => [...prev, { name: '', quantity: 1, unit: null }])
  }

  const handleUpdateIngredient = (index: number, updated: NewRecipeIngredientInput) => {
    setIngredients((prev) => {
      const next = [...prev]
      next[index] = updated
      return next
    })
  }

  const handleRemoveIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!canSave) return

    const validIngredients = ingredients.filter((ing) => ing.name.trim().length > 0)
    const targetId = recipeId ?? randomUuid()
    let imagePath = existingRecipe?.imagePath ?? null

    if (imageChange.kind === 'replace') {
      imagePath = await supabaseRecipeRepository.uploadImage({
        communityId,
        recipeId: targetId,
        uri: imageChange.uri,
      })
      if (existingRecipe?.imagePath && existingRecipe.imagePath !== imagePath) {
        void supabaseRecipeRepository.removeImage(existingRecipe.imagePath).catch(() => undefined)
      }
    } else if (imageChange.kind === 'clear') {
      if (existingRecipe?.imagePath) {
        void supabaseRecipeRepository.removeImage(existingRecipe.imagePath).catch(() => undefined)
      }
      imagePath = null
    }

    const payload: NewRecipeInput = {
      id: targetId,
      communityId,
      title: title.trim(),
      servings,
      instructions: instructions.trim(),
      imagePath,
      ingredients: validIngredients,
    }

    try {
      const savedId = await saveRecipeMutation.mutateAsync(payload)
      if (isEditing) {
        router.back()
      } else {
        router.replace(`/recipes/${savedId}` as never)
      }
    } catch {
      // Manejado en el hook vía useErrorSnackbar
    }
  }

  if (isEditing && isLoadingRecipe) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <Text className="text-base text-muted dark:text-muted-dark">{t('recipes.loading')}</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-1">
        {/* Barra superior */}
        <View className="flex-row items-center justify-between border-b border-line px-4 py-3 dark:border-line-dark">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            onPress={() => router.back()}
            style={{ minHeight: minTouchTarget, minWidth: minTouchTarget }}
            className="items-center justify-center"
          >
            <Text className="text-base text-primary dark:text-primary-dark">
              {t('common.cancel')}
            </Text>
          </Pressable>

          <Text className="text-lg font-bold text-content dark:text-content-dark">
            {isEditing ? t('recipes.editTitle') : t('recipes.newTitle')}
          </Text>

          <Button
            label={t('recipes.save')}
            onPress={() => void handleSave()}
            disabled={!canSave}
            loading={saveRecipeMutation.isPending}
            size="sm"
            fullWidth={false}
          />
        </View>

        <ScrollView
          className="flex-1 px-4 py-4"
          contentContainerStyle={{ gap: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Nombre de la receta */}
          <Input
            label={t('recipes.titleLabel')}
            placeholder={t('recipes.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
            autoFocus={!isEditing}
          />

          {/* Foto de portada */}
          <View className="gap-2">
            <Text className="text-base font-medium text-content dark:text-content-dark">
              {t('recipes.image.sectionLabel')}
            </Text>

            {hasCoverImage ? (
              <View className="gap-2">
                <View className="overflow-hidden rounded-lg border border-line dark:border-line-dark">
                  <RecipeImage
                    path={previewPath}
                    localUri={previewLocalUri}
                    name={title || t('recipes.image.sectionLabel')}
                    width="100%"
                    height={180}
                  />
                </View>
                <View className="flex-row items-center gap-2">
                  <Button
                    label={`📷 ${t('items.image.camera')}`}
                    onPress={() => void handlePickCover('camera')}
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    accessibilityHint={t('items.image.cameraHint')}
                  />
                  <Button
                    label={`🖼️ ${t('items.image.gallery')}`}
                    onPress={() => void handlePickCover('gallery')}
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    accessibilityHint={t('items.image.galleryHint')}
                  />
                  <Button
                    label={t('recipes.image.remove')}
                    onPress={() => setImageChange({ kind: 'clear' })}
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    accessibilityHint={t('recipes.image.removeHint')}
                  />
                </View>
              </View>
            ) : (
              <View className="items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong p-4 dark:border-line-strong-dark">
                <Text className="text-sm text-muted dark:text-muted-dark">
                  {t('recipes.image.empty')}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Button
                    label={`📷 ${t('items.image.camera')}`}
                    onPress={() => void handlePickCover('camera')}
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    accessibilityHint={t('items.image.cameraHint')}
                  />
                  <Button
                    label={`🖼️ ${t('items.image.gallery')}`}
                    onPress={() => void handlePickCover('gallery')}
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    accessibilityHint={t('items.image.galleryHint')}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Comensales */}
          <View className="gap-2">
            <Text className="text-base font-medium text-content dark:text-content-dark">
              {t('recipes.servingsLabel')}
            </Text>
            <View className="flex-row items-center gap-3">
              <QuantityStepper
                value={servings}
                onChange={setServings}
                min={1}
                decrementLabel={t('recipes.servingsDecrement')}
                incrementLabel={t('recipes.servingsIncrement')}
                valueLabel={t('recipes.servingsCount', { count: servings })}
              />
              <Text className="text-sm text-muted dark:text-muted-dark">
                {t('recipes.servingsHint')}
              </Text>
            </View>
          </View>

          {/* Ingredientes */}
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-medium text-content dark:text-content-dark">
                {t('recipes.ingredientsLabel')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('recipes.addIngredient')}
                onPress={handleAddIngredient}
                style={{ minHeight: minTouchTarget }}
                className="justify-center"
              >
                <Text className="text-sm font-semibold text-primary dark:text-primary-dark">
                  + {t('recipes.addIngredient')}
                </Text>
              </Pressable>
            </View>

            <View className="gap-2">
              {ingredients.map((ingredient, index) => (
                <IngredientInputRow
                  key={ingredient.id ?? `temp-${index}`}
                  ingredient={ingredient}
                  onChange={(updated) => handleUpdateIngredient(index, updated)}
                  onRemove={() => handleRemoveIngredient(index)}
                  canRemove={ingredients.length > 1}
                />
              ))}
            </View>
          </View>

          {/* Instrucciones */}
          <View className="gap-2">
            <Text className="text-base font-medium text-content dark:text-content-dark">
              {t('recipes.instructionsLabel')}
            </Text>
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder={t('recipes.instructionsPlaceholder')}
              placeholderTextColor={palette.textMuted}
              multiline
              numberOfLines={5}
              style={{ minHeight: 120, textAlignVertical: 'top', color: palette.text }}
              className="rounded-lg border border-line bg-surface p-3 text-base dark:border-line-dark dark:bg-surface-dark"
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}
