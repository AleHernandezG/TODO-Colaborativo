import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { itemsKey, supabaseItemRepository } from '@/features/items'
import { supabaseNotificationsRepository } from '@/features/notifications'
import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'
import { captureError } from '@/shared/lib/observability'
import { randomUuid } from '@/shared/lib/uuid'

import type { ConsolidatedIngredient } from '../../domain/meal-plan'

export type AddMealPlanToListInput = {
  ingredients: ConsolidatedIngredient[]
}

export function useAddMealPlanToList(communityId: string) {
  const queryClient = useQueryClient()
  const showError = useErrorSnackbar()
  const { t } = useTranslation()

  return useMutation<number, Error, AddMealPlanToListInput>({
    mutationFn: async ({ ingredients }) => {
      if (ingredients.length === 0) return 0

      const itemsToAdd = ingredients.map((ing) => {
        const isUnitCount =
          !ing.unit ||
          ing.unit.toLowerCase() === 'ud' ||
          ing.unit.toLowerCase() === 'uds' ||
          ing.unit.toLowerCase() === 'unidad' ||
          ing.unit.toLowerCase() === 'unidades'

        const name = isUnitCount ? ing.name : `${ing.name} (${ing.quantity} ${ing.unit})`
        const quantity = isUnitCount ? Math.max(1, Math.round(ing.quantity)) : 1

        return {
          id: randomUuid(),
          communityId,
          name,
          quantity,
          catalogProductId: ing.catalogProductId,
        }
      })

      await supabaseItemRepository.addMany(itemsToAdd)
      return itemsToAdd.length
    },
    onSuccess: (addedCount) => {
      if (addedCount === 0) return

      void queryClient.invalidateQueries({ queryKey: itemsKey(communityId) })

      void supabaseNotificationsRepository
        .notifyCommunity({
          communityId,
          title: t('mealPlanner.notifications.menuAddedTitle'),
          body: t('mealPlanner.notifications.menuAddedBody', { count: addedCount }),
          data: { url: '/list' },
        })
        .catch((err) => {
          captureError(err, { tags: { area: 'push-notifications' } })
        })
    },
    onError: (error) => {
      showError(error, t('mealPlanner.errors.addToListFailed'))
    },
  })
}
