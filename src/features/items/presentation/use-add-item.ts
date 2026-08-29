import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'
import { randomUuid } from '@/shared/lib/uuid'

import type { AddItemResult } from '../domain/add-item'
import type { Item } from '../domain/item'
import { normalizeItemName } from '../domain/item-name'
import type { AddItemVariables } from './item-mutations'
import { itemMutationKeys } from './item-mutations'
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })

  return {
    mutate: (input: { name: string; quantity: number; catalogProductId: string | null }) =>
      mutation.mutate({ ...input, id: randomUuid(), communityId }),
  }
}
