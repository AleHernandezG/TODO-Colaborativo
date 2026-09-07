import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { supabaseNotificationsRepository } from '@/features/notifications'
import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'
import { captureError } from '@/shared/lib/observability'
import { randomUuid } from '@/shared/lib/uuid'

import type { AddItemResult } from '../../domain/add-item'
import type { Item } from '../../domain/item'
import { normalizeItemName } from '../../domain/item-name'
import type { AddItemVariables } from '../mutations/item-mutations'
import { itemMutationKeys } from '../mutations/item-mutations'
import { itemsKey } from './use-items'

type MutationContext = { previous: Item[] | undefined }

export function useAddItem(communityId: string) {
  const queryClient = useQueryClient()
  const showError = useErrorSnackbar()
  const { t } = useTranslation()
  const key = itemsKey(communityId)

  const mutation = useMutation<AddItemResult, Error, AddItemVariables, MutationContext>({
    mutationKey: itemMutationKeys.add,
    onMutate: async (input): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Item[]>(key)

      const optimistic: Item = {
        id: input.id,
        name: normalizeItemName(input.name),
        quantity: input.quantity,
        isPurchased: false,
        imagePath: null,
        catalogProductId: input.catalogProductId,
        createdAt: new Date().toISOString(),
      }

      queryClient.setQueryData<Item[]>(key, (current = []) => [optimistic, ...current])
      return { previous }
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData<Item[]>(key, context?.previous ?? [])
      showError(error, t('items.errors.addFailed'))
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: key })
      void supabaseNotificationsRepository
        .notifyCommunity({
          communityId,
          title: t('notifications.itemAddedTitle'),
          body: t('notifications.itemAddedBody', {
            quantity: variables.quantity,
            name: variables.name,
          }),
          data: { url: '/list' },
        })
        .catch((err) => {
          captureError(err, { tags: { area: 'push-notifications' } })
        })
    },
  })

  return {
    mutate: (input: {
      name: string
      quantity: number
      catalogProductId: string | null
      imageUri?: string | null
    }) => mutation.mutate({ ...input, id: randomUuid(), communityId }),
  }
}
