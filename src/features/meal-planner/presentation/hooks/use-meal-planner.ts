import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import { supabaseMealPlannerRepository } from '../../data/supabase-meal-planner-repository'
import {
  getWeekDates,
  MealPlanSlotWithRecipe,
  MealType,
  UpsertMealSlotInput,
  WeekRange,
} from '../../domain/meal-plan'

export const mealPlanBaseKey = (communityId: string) => ['meal_plan', communityId] as const

export const mealPlanWeekKey = (communityId: string, monday: string, sunday: string) =>
  ['meal_plan', communityId, monday, sunday] as const

export function useMealPlanWeek(communityId: string, referenceDate: string | Date) {
  const queryClient = useQueryClient()
  const weekRange: WeekRange = useMemo(() => getWeekDates(referenceDate), [referenceDate])

  const queryKey = mealPlanWeekKey(communityId, weekRange.monday, weekRange.sunday)

  const query = useQuery<MealPlanSlotWithRecipe[]>({
    queryKey,
    queryFn: () =>
      supabaseMealPlannerRepository.getWeekSlots(
        communityId,
        weekRange.monday,
        weekRange.sunday,
      ),
    enabled: Boolean(communityId),
    staleTime: 1000 * 60 * 5,
  })

  useEffect(() => {
    if (!communityId) return

    const unsubscribe = supabaseMealPlannerRepository.subscribe(communityId, {
      onChange: () => {
        void queryClient.invalidateQueries({ queryKey: mealPlanBaseKey(communityId) })
      },
    })

    return () => {
      unsubscribe()
    }
  }, [communityId, queryClient])

  return {
    ...query,
    weekRange,
    slots: query.data ?? [],
  }
}

export function useUpsertMealSlot(communityId: string) {
  const queryClient = useQueryClient()

  return useMutation<string, Error, Omit<UpsertMealSlotInput, 'communityId'>>({
    mutationFn: (input) =>
      supabaseMealPlannerRepository.upsertSlot({
        ...input,
        communityId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mealPlanBaseKey(communityId) })
    },
  })
}

export function useDeleteMealSlot(communityId: string) {
  const queryClient = useQueryClient()

  return useMutation<void, Error, { date: string; mealType: MealType }>({
    mutationFn: ({ date, mealType }) =>
      supabaseMealPlannerRepository.deleteSlot(communityId, date, mealType),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mealPlanBaseKey(communityId) })
    },
  })
}
