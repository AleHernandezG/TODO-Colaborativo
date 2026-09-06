import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveCommunityStore } from '@/features/community'
import { Button } from '@/shared/ui/Button'
import { minTouchTarget, usePalette } from '@/theme'

import type { Recipe } from '../../domain/recipe'
import { useRecipes, useRecipesRealtime } from '../hooks/use-recipes'

export function RecipesScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const palette = usePalette()
  const membership = useActiveCommunityStore((state) => state.membership)
  const communityId = membership?.community.id ?? ''

  const { data: recipes = [], isLoading, isFetching, refetch } = useRecipes(communityId)
  useRecipesRealtime(communityId)

  const [searchQuery, setSearchQuery] = useState('')

  const filteredRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return recipes
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.ingredients.some((ing) => ing.name.toLowerCase().includes(q)),
    )
  }, [recipes, searchQuery])

  const renderRecipeItem = ({ item }: { item: Recipe }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.servings} raciones`}
      onPress={() => router.push(`/recipes/${item.id}` as never)}
      style={{ minHeight: minTouchTarget }}
      className="flex-row items-center justify-between rounded-xl border border-line bg-surface p-4 active:opacity-80 dark:border-line-dark dark:bg-surface-dark"
    >
      <View className="flex-1 gap-1.5">
        <Text className="text-lg font-bold text-content dark:text-content-dark">
          {item.title}
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <View className="rounded-md bg-background px-2 py-0.5 dark:bg-background-dark">
            <Text className="text-xs font-medium text-muted dark:text-muted-dark">
              🍽️ {t('recipes.servingsCount', { count: item.servings })}
            </Text>
          </View>
          <View className="rounded-md bg-background px-2 py-0.5 dark:bg-background-dark">
            <Text className="text-xs font-medium text-muted dark:text-muted-dark">
              🥕 {t('recipes.ingredientsCount', { count: item.ingredients.length })}
            </Text>
          </View>
        </View>
      </View>
      <Text className="text-lg text-muted dark:text-muted-dark">›</Text>
    </Pressable>
  )

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-1 px-4 py-3 gap-3">
        {/* Cabecera */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              onPress={() => router.back()}
              style={{ minHeight: minTouchTarget, minWidth: minTouchTarget }}
              className="items-center justify-center"
            >
              <Text className="text-base text-primary dark:text-primary-dark">
                ‹ {t('common.cancel')}
              </Text>
            </Pressable>
            <Text className="text-2xl font-bold text-content dark:text-content-dark">
              {t('recipes.screenTitle')}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Button
              label={t('mealPlanner.menuButton')}
              onPress={() => router.push('/meal-planner' as never)}
              variant="secondary"
              size="sm"
              fullWidth={false}
            />
            <Button
              label={t('recipes.newButton')}
              onPress={() => router.push('/recipes/new' as never)}
              size="sm"
              fullWidth={false}
            />
          </View>
        </View>

        {/* Buscador */}
        {recipes.length > 0 ? (
          <View className="rounded-lg border border-line bg-surface px-3 py-2 dark:border-line-dark dark:bg-surface-dark">
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('recipes.searchPlaceholder')}
              placeholderTextColor={palette.textMuted}
              style={{ color: palette.text }}
              className="text-base"
            />
          </View>
        ) : null}

        {/* Lista */}
        <FlatList
          data={filteredRecipes}
          keyExtractor={(item) => item.id}
          renderItem={renderRecipeItem}
          contentContainerStyle={{ gap: 10, paddingVertical: 8, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => void refetch()}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center gap-3 py-12">
              <Text className="text-4xl">👨‍🍳</Text>
              <Text className="text-center text-lg font-semibold text-content dark:text-content-dark">
                {searchQuery ? t('recipes.emptySearch') : t('recipes.emptyTitle')}
              </Text>
              <Text className="text-center text-sm text-muted dark:text-muted-dark px-6">
                {searchQuery ? t('recipes.emptySearchHint') : t('recipes.emptySubtitle')}
              </Text>
              {!searchQuery ? (
                <View className="mt-2">
                  <Button
                    label={t('recipes.createFirst')}
                    onPress={() => router.push('/recipes/new' as never)}
                    fullWidth={false}
                  />
                </View>
              ) : null}
            </View>
          }
        />
      </View>
    </SafeAreaView>
  )
}
