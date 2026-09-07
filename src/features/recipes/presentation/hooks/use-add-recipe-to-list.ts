import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { inferItemCategory, itemsKey, supabaseItemRepository } from '@/features/items'
import { supabaseNotificationsRepository } from '@/features/notifications'
import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'
import { captureError } from '@/shared/lib/observability'
import { randomUuid } from '@/shared/lib/uuid'

export type RecipeItemToAdd = {
  name: string
  quantity: number
  catalogProductId: string | null
}

export type AddRecipeToListInput = {
  recipeTitle: string
  items: RecipeItemToAdd[]
}

export function useAddRecipeToList(communityId: string) {
  const queryClient = useQueryClient()
  const showError = useErrorSnackbar()
  const { t } = useTranslation()

  return useMutation<number, Error, AddRecipeToListInput>({
    mutationFn: async ({ items }) => {
      if (items.length === 0) return 0

      const itemsWithIds = items.map((item) => ({
        id: randomUuid(),
        communityId,
        name: item.name,
        quantity: Math.max(1, Math.round(item.quantity)),
        catalogProductId: item.catalogProductId,
        category: inferItemCategory(item.name),
      }))

      await supabaseItemRepository.addMany(itemsWithIds)
      return itemsWithIds.length
    },
    onSuccess: (addedCount, { recipeTitle }) => {
      if (addedCount === 0) return

      void queryClient.invalidateQueries({ queryKey: itemsKey(communityId) })

      void supabaseNotificationsRepository
        .notifyCommunity({
          communityId,
          title: t('recipes.notifications.ingredientsAddedTitle'),
          body: t('recipes.notifications.ingredientsAddedBody', {
            recipeTitle,
            count: addedCount,
          }),
          data: { url: '/list' },
        })
        .catch((err) => {
          captureError(err, { tags: { area: 'push-notifications' } })
        })
    },
    onError: (error) => {
      showError(error, t('recipes.errors.addToListFailed'))
    },
  })
}
