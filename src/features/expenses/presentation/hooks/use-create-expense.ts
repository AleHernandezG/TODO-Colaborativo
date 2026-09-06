import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { supabaseNotificationsRepository } from '@/features/notifications'
import { useSessionStore } from '@/features/session'
import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'
import { captureError } from '@/shared/lib/observability'
import { randomUuid } from '@/shared/lib/uuid'

import type { Expense } from '../../domain/expense'
import { formatCents } from '../../domain/money'
import type { CreateExpenseVariables } from '../mutations/expense-mutations'
import { expenseMutationKeys } from '../mutations/expense-mutations'
import { expensesKey } from './use-expenses'

type MutationContext = { previous: Expense[] | undefined }

export type NewExpense = Omit<CreateExpenseVariables, 'id' | 'communityId'>

export function useCreateExpense(communityId: string) {
  const queryClient = useQueryClient()
  const showError = useErrorSnackbar()
  const { t } = useTranslation()
  const key = expensesKey(communityId)

  const mutation = useMutation<void, Error, CreateExpenseVariables, MutationContext>({
    mutationKey: expenseMutationKeys.addExpense,
    onMutate: async (input): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Expense[]>(key)
      const now = new Date().toISOString()

      const optimistic: Expense = {
        id: input.id,
        communityId: input.communityId,
        itemId: input.itemId ?? null,
        paidByMemberId: input.paidByMemberId,
        createdByAuthUserId: useSessionStore.getState().session?.userId ?? '',
        amountCents: input.amountCents,
        currency: input.currency ?? 'EUR',
        description: input.description,
        createdAt: now,
        updatedAt: now,
        shares: input.shares.map((share) => ({
          id: randomUuid(),
          expenseId: input.id,
          memberId: share.memberId,
          shareCents: share.shareCents,
        })),
      }

      queryClient.setQueryData<Expense[]>(key, (current = []) => [optimistic, ...current])
      return { previous }
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData<Expense[]>(key, context?.previous ?? [])
      showError(error, t('expenses.errors.addFailed'))
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: key })
      void supabaseNotificationsRepository
        .notifyCommunity({
          communityId,
          title: t('notifications.expenseAddedTitle'),
          body: t('notifications.expenseAddedBody', {
            amount: formatCents(variables.amountCents, variables.currency ?? 'EUR'),
            description: variables.description,
          }),
          data: { url: '/expenses' },
        })
        .catch((err) => {
          captureError(err, { tags: { area: 'push-notifications' } })
        })
    },
  })

  return {
    mutate: (input: NewExpense) => mutation.mutate({ ...input, id: randomUuid(), communityId }),
  }
}
