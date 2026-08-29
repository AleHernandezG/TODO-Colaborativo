import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'

import type { Item } from '../domain/item'
import type { ItemMutationVariables } from './item-mutations'
import { itemMutationKeys } from './item-mutations'
import { itemsKey } from './use-items'

type MutationContext = { previous: Item[] | undefined }

export function useTogglePurchased(communityId: string) {
  const queryClient = useQueryClient()
  const showError = useErrorSnackbar()
  const { t } = useTranslation()
  const key = itemsKey(communityId)

  const mutation = useMutation<void, Error, ItemMutationVariables, MutationContext>({
    mutationKey: itemMutationKeys.togglePurchased,
    onMutate: async ({ item }): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Item[]>(key)

      queryClient.setQueryData<Item[]>(key, (current = []) =>
        current.map((i) => (i.id === item.id ? { ...i, isPurchased: !i.isPurchased } : i)),
      )
      return { previous }
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData<Item[]>(key, context?.previous ?? [])
      showError(error, t('items.errors.updateFailed'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })

  return {
    mutate: (item: Item) => mutation.mutate({ communityId, item }),
  }
}
