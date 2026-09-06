import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useActiveCommunityStore } from '@/features/community'
import { useRecipes } from '@/features/recipes'
import { Button } from '@/shared/ui/Button'
import { minTouchTarget, usePalette } from '@/theme'

import {
  consolidateMealPlanIngredients,
  formatDateIso,
  MealPlanSlotWithRecipe,
  MealType,
  parseDateIso,
  WeekDayInfo,
} from '../../domain/meal-plan'
import { AssignMealModal } from '../components/AssignMealModal'
import { ConsolidatedReviewModal } from '../components/ConsolidatedReviewModal'
import { useAddMealPlanToList } from '../hooks/use-add-meal-plan-to-list'
import {
  useDeleteMealSlot,
  useMealPlanWeek,
  useUpsertMealSlot,
} from '../hooks/use-meal-planner'

export function MealPlannerScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const palette = usePalette()
  const membership = useActiveCommunityStore((state) => state.membership)
  const communityId = membership?.community.id ?? ''

  // Fecha seleccionada para anclar la semana actual
  const [currentReferenceDate, setCurrentReferenceDate] = useState<string>(
    formatDateIso(new Date()),
  )

  const { slots, weekRange, isLoading } = useMealPlanWeek(
    communityId,
    currentReferenceDate,
  )

  const { data: recipes = [] } = useRecipes(communityId)
  const upsertMutation = useUpsertMealSlot(communityId)
  const deleteMutation = useDeleteMealSlot(communityId)
  const addToListMutation = useAddMealPlanToList(communityId)

  // Estado del modal de asignación
  const [assignModalState, setAssignModalState] = useState<{
    visible: boolean
    dateStr: string
    mealType: MealType
    slot: MealPlanSlotWithRecipe | null
  }>({
    visible: false,
    dateStr: '',
    mealType: 'lunch',
    slot: null,
  })

  // Estado del modal de consolidación
  const [isConsolidatedModalVisible, setIsConsolidatedModalVisible] = useState(false)

  // Mapa rápido de slots por clave `${date}_${mealType}`
  const slotsMap = useMemo(() => {
    const map = new Map<string, MealPlanSlotWithRecipe>()
    for (const slot of slots) {
      map.set(`${slot.date}_${slot.mealType}`, slot)
    }
    return map
  }, [slots])

  // Consolidación de ingredientes de toda la semana
  const consolidatedIngredients = useMemo(() => {
    return consolidateMealPlanIngredients(slots)
  }, [slots])

  // Controles de navegación de semana
  const goToPreviousWeek = () => {
    const d = parseDateIso(currentReferenceDate)
    d.setDate(d.getDate() - 7)
    setCurrentReferenceDate(formatDateIso(d))
  }

  const goToNextWeek = () => {
    const d = parseDateIso(currentReferenceDate)
    d.setDate(d.getDate() + 7)
    setCurrentReferenceDate(formatDateIso(d))
  }

  const goToCurrentWeek = () => {
    setCurrentReferenceDate(formatDateIso(new Date()))
  }

  const isCurrentWeek = useMemo(() => {
    const todayIso = formatDateIso(new Date())
    return weekRange.days.some((d: WeekDayInfo) => d.date === todayIso)
  }, [weekRange])

  // Formato de rango de fechas de la semana (ej: "7 – 13 sep 2026")
  const weekLabel = useMemo(() => {
    const mon = parseDateIso(weekRange.monday)
    const sun = parseDateIso(weekRange.sunday)
    const locale = i18n.language.startsWith('en') ? 'en-US' : 'es-ES'

    const monMonth = mon.toLocaleDateString(locale, { month: 'short' })
    const sunMonth = sun.toLocaleDateString(locale, { month: 'short' })
    const year = sun.getFullYear()

    if (monMonth === sunMonth) {
      return `${mon.getDate()} – ${sun.getDate()} ${sunMonth} ${year}`
    }
    return `${mon.getDate()} ${monMonth} – ${sun.getDate()} ${sunMonth} ${year}`
  }, [weekRange, i18n.language])

  // Formateador del nombre del día (ej: "Lunes", "7 sep")
  const formatDayHeader = (dateStr: string) => {
    const d = parseDateIso(dateStr)
    const locale = i18n.language.startsWith('en') ? 'en-US' : 'es-ES'
    const weekday = d.toLocaleDateString(locale, { weekday: 'long' })
    const dayAndMonth = d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    return {
      weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
      dayAndMonth,
    }
  }

  const openAssignModal = (dateStr: string, mealType: MealType) => {
    const slot = slotsMap.get(`${dateStr}_${mealType}`) ?? null
    setAssignModalState({
      visible: true,
      dateStr,
      mealType,
      slot,
    })
  }

  const handleSaveSlot = (payload: {
    recipeId: string | null
    customDishName: string | null
    servings: number
    notes: string | null
  }) => {
    upsertMutation.mutate({
      date: assignModalState.dateStr,
      mealType: assignModalState.mealType,
      recipeId: payload.recipeId,
      customDishName: payload.customDishName,
      servings: payload.servings,
      notes: payload.notes,
    })
  }

  const handleDeleteSlot = () => {
    deleteMutation.mutate({
      date: assignModalState.dateStr,
      mealType: assignModalState.mealType,
    })
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-background-dark" edges={['top']}>
      {/* Cabecera superior */}
      <View className="flex-row items-center justify-between border-b border-line px-4 py-3 dark:border-line-dark">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back', { defaultValue: 'Volver' })}
          onPress={() => router.back()}
          style={{ minHeight: minTouchTarget, minWidth: minTouchTarget }}
          className="justify-center active:opacity-70"
        >
          <Text className="text-base font-medium text-primary">← {t('common.back', { defaultValue: 'Volver' })}</Text>
        </Pressable>

        <Text className="text-lg font-bold text-content dark:text-content-dark">
          {t('mealPlanner.title')}
        </Text>

        <View style={{ width: minTouchTarget }} />
      </View>

      {/* Selector de semana */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-line bg-surface dark:border-line-dark dark:bg-surface-dark">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mealPlanner.previousWeek')}
          onPress={goToPreviousWeek}
          style={{ minHeight: minTouchTarget, minWidth: minTouchTarget }}
          className="items-center justify-center rounded-lg active:bg-line/40 dark:active:bg-line-dark/40"
        >
          <Text className="text-lg font-bold text-content dark:text-content-dark">‹</Text>
        </Pressable>

        <View className="items-center">
          <Text className="text-sm font-bold text-content dark:text-content-dark">
            {weekLabel}
          </Text>
          {!isCurrentWeek && (
            <TouchableOpacity onPress={goToCurrentWeek} className="mt-0.5">
              <Text className="text-xs font-semibold text-primary">
                {t('mealPlanner.goToCurrentWeek')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mealPlanner.nextWeek')}
          onPress={goToNextWeek}
          style={{ minHeight: minTouchTarget, minWidth: minTouchTarget }}
          className="items-center justify-center rounded-lg active:bg-line/40 dark:active:bg-line-dark/40"
        >
          <Text className="text-lg font-bold text-content dark:text-content-dark">›</Text>
        </Pressable>
      </View>

      {/* Barra de acción rápida para volcar a lista */}
      {consolidatedIngredients.length > 0 && (
        <View className="px-4 py-2.5 bg-primary/10 border-b border-primary/20 flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-xs font-bold text-primary">
              {t('mealPlanner.consolidatedBanner.title', {
                count: consolidatedIngredients.length,
              })}
            </Text>
            <Text className="text-xs text-content-muted dark:text-content-muted-dark">
              {t('mealPlanner.consolidatedBanner.subtitle')}
            </Text>
          </View>
          <Button
            label={t('mealPlanner.addToListButton')}
            onPress={() => setIsConsolidatedModalVisible(true)}
            size="sm"
          />
        </View>
      )}

      {/* Lista de días (Lunes a Domingo) */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4 py-3"
          contentContainerStyle={{ gap: 14, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {weekRange.days.map((day: WeekDayInfo) => {
            const { weekday, dayAndMonth } = formatDayHeader(day.date)
            const lunchSlot = slotsMap.get(`${day.date}_lunch`)
            const dinnerSlot = slotsMap.get(`${day.date}_dinner`)

            return (
              <View
                key={day.date}
                className="rounded-2xl border border-line bg-surface p-3.5 shadow-sm dark:border-line-dark dark:bg-surface-dark"
                style={{
                  borderColor: day.isToday ? palette.primary : undefined,
                  borderWidth: day.isToday ? 1.5 : 1,
                }}
              >
                {/* Cabecera del día */}
                <View className="flex-row items-center justify-between pb-2 mb-2 border-b border-line dark:border-line-dark">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-content dark:text-content-dark">
                      {weekday}
                    </Text>
                    <Text className="text-xs text-content-muted dark:text-content-muted-dark">
                      {dayAndMonth}
                    </Text>
                  </View>
                  {day.isToday && (
                    <View className="rounded-full bg-primary/15 px-2.5 py-0.5">
                      <Text className="text-xs font-semibold text-primary">
                        {t('mealPlanner.today')}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Comida (Lunch) */}
                <View className="mb-2">
                  <Text className="text-xs font-semibold uppercase tracking-wider text-content-muted dark:text-content-muted-dark mb-1">
                    {t('mealPlanner.mealTypes.lunch')}
                  </Text>
                  <Pressable
                    onPress={() => openAssignModal(day.date, 'lunch')}
                    className="rounded-xl border border-dashed border-line p-2.5 justify-center active:opacity-75 dark:border-line-dark"
                    style={{
                      minHeight: 48,
                      backgroundColor: lunchSlot ? `${palette.primary}08` : 'transparent',
                      borderColor: lunchSlot ? palette.border : palette.border,
                    }}
                  >
                    {lunchSlot ? (
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 mr-2">
                          <Text className="text-sm font-semibold text-content dark:text-content-dark">
                            {lunchSlot.recipe?.title ?? lunchSlot.customDishName}
                          </Text>
                          {lunchSlot.notes && (
                            <Text className="text-xs text-content-muted dark:text-content-muted-dark mt-0.5">
                              {lunchSlot.notes}
                            </Text>
                          )}
                        </View>
                        <View className="rounded-md bg-line px-2 py-0.5 dark:bg-line-dark">
                          <Text className="text-xs font-medium text-content dark:text-content-dark">
                            {lunchSlot.servings} {t('mealPlanner.servingsShort')}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text className="text-xs text-content-muted dark:text-content-muted-dark text-center">
                        + {t('mealPlanner.addLunch')}
                      </Text>
                    )}
                  </Pressable>
                </View>

                {/* Cena (Dinner) */}
                <View>
                  <Text className="text-xs font-semibold uppercase tracking-wider text-content-muted dark:text-content-muted-dark mb-1">
                    {t('mealPlanner.mealTypes.dinner')}
                  </Text>
                  <Pressable
                    onPress={() => openAssignModal(day.date, 'dinner')}
                    className="rounded-xl border border-dashed border-line p-2.5 justify-center active:opacity-75 dark:border-line-dark"
                    style={{
                      minHeight: 48,
                      backgroundColor: dinnerSlot ? `${palette.primary}08` : 'transparent',
                      borderColor: dinnerSlot ? palette.border : palette.border,
                    }}
                  >
                    {dinnerSlot ? (
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 mr-2">
                          <Text className="text-sm font-semibold text-content dark:text-content-dark">
                            {dinnerSlot.recipe?.title ?? dinnerSlot.customDishName}
                          </Text>
                          {dinnerSlot.notes && (
                            <Text className="text-xs text-content-muted dark:text-content-muted-dark mt-0.5">
                              {dinnerSlot.notes}
                            </Text>
                          )}
                        </View>
                        <View className="rounded-md bg-line px-2 py-0.5 dark:bg-line-dark">
                          <Text className="text-xs font-medium text-content dark:text-content-dark">
                            {dinnerSlot.servings} {t('mealPlanner.servingsShort')}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text className="text-xs text-content-muted dark:text-content-muted-dark text-center">
                        + {t('mealPlanner.addDinner')}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}

      {/* Modal de asignación de comida/cena */}
      <AssignMealModal
        visible={assignModalState.visible}
        onDismiss={() => setAssignModalState((prev) => ({ ...prev, visible: false }))}
        onSave={handleSaveSlot}
        onDelete={assignModalState.slot ? handleDeleteSlot : undefined}
        mealType={assignModalState.mealType}
        dateStr={assignModalState.dateStr}
        slot={assignModalState.slot}
        availableRecipes={recipes}
      />

      {/* Modal de revisión de ingredientes consolidados */}
      <ConsolidatedReviewModal
        visible={isConsolidatedModalVisible}
        onDismiss={() => setIsConsolidatedModalVisible(false)}
        ingredients={consolidatedIngredients}
        isSubmitting={addToListMutation.isPending}
        onConfirm={(selectedIngredients) => {
          addToListMutation.mutate(
            { ingredients: selectedIngredients },
            {
              onSuccess: () => {
                setIsConsolidatedModalVisible(false)
              },
            },
          )
        }}
      />
    </SafeAreaView>
  )
}
