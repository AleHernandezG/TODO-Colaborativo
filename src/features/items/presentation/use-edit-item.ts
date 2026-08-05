import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useSnackbar } from '../../../shared/hooks/use-snackbar'
import { OfflineError } from '../../../shared/lib/network'
import type { EditItemResult, ItemImageChange } from '../domain/edit-item'
import type { Item } from '../domain/item'
import { normalizeItemName } from '../domain/item-name'
import type { EditItemVariables } from './item-mutations'
import { itemMutationKeys } from './item-mutations'
import { itemsKey } from './use-items'

export type EditInput = {
  itemId: string
  name: string
  quantity: number
  image: ItemImageChange
  currentImagePath: string | null
}

type MutationContext = { previous: Item[] | undefined }

export function useEditItem(communityId: string) {
  const queryClient = useQueryClient()
  const showSnackbar = useSnackbar()
  const { t } = useTranslation()
  const key = itemsKey(communityId)

  const mutation = useMutation<EditItemResult, Error, EditItemVariables, MutationContext>({
    mutationKey: itemMutationKeys.edit,
    onMutate: async (input): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Item[]>(key)

      queryClient.setQueryData<Item[]>(key, (current = []) =>
        current.map((item) =>
          item.id === input.itemId
            ? {
                ...item,
                name: normalizeItemName(input.name),
                quantity: input.quantity,
                imagePath: input.image.kind === 'clear' ? null : item.imagePath,
              }
            : item,
        ),
      )
      return { previous }
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData<Item[]>(key, context?.previous ?? [])
      showSnackbar(
        error instanceof OfflineError ? t('errors.offline') : t('items.errors.updateFailed'),
      )
    },
    onSuccess: (result) => {
      if (result.status !== 'ok') {
        showSnackbar(t('items.errors.updateFailed'))
      }
      queryClient.invalidateQueries({ queryKey: key })
    },
  })

  return {
    mutate: (input: EditInput) => mutation.mutate({ ...input, communityId }),
    isPending: mutation.isPending,
    variables: mutation.variables,
  }
}
