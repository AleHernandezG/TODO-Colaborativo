import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useErrorSnackbar } from '../../../shared/hooks/use-error-snackbar'
import { randomUuid } from '../../../shared/lib/uuid'
import { useSessionStore } from '../../session/presentation/session-store'
import type { Settlement } from '../domain/expense'
import type { CreateSettlementVariables } from './expense-mutations'
import { expenseMutationKeys } from './expense-mutations'
import { settlementsKey } from './use-settlements'

type MutationContext = { previous: Settlement[] | undefined }

export type NewSettlement = Omit<CreateSettlementVariables, 'id' | 'communityId'>

export function useCreateSettlement(communityId: string) {
  const queryClient = useQueryClient()
  const showError = useErrorSnackbar()
  const { t } = useTranslation()
  const key = settlementsKey(communityId)

  const mutation = useMutation<void, Error, CreateSettlementVariables, MutationContext>({
    mutationKey: expenseMutationKeys.addSettlement,
    onMutate: async (input): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Settlement[]>(key)

      const optimistic: Settlement = {
        id: input.id,
        communityId: input.communityId,
        fromMemberId: input.fromMemberId,
        toMemberId: input.toMemberId,
        amountCents: input.amountCents,
        currency: input.currency ?? 'EUR',
        createdByAuthUserId: useSessionStore.getState().session?.userId ?? '',
        createdAt: new Date().toISOString(),
      }

      queryClient.setQueryData<Settlement[]>(key, (current = []) => [optimistic, ...current])
      return { previous }
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData<Settlement[]>(key, context?.previous ?? [])
      showError(error, t('expenses.errors.settleFailed'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })

  return {
    mutate: (input: NewSettlement) => mutation.mutate({ ...input, id: randomUuid(), communityId }),
  }
}
