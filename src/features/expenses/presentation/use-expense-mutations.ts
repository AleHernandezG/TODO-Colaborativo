import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabaseExpenseRepository } from '../data/supabase-expense-repository'
import type { CreateExpenseInput, CreateSettlementInput } from '../domain/expense-repository'

export function useCreateExpense(communityId: string | null | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateExpenseInput) => supabaseExpenseRepository.createExpense(input),
    onSuccess: () => {
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: ['expenses', communityId] })
      }
    },
  })
}

export function useDeleteExpense(communityId: string | null | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (expenseId: string) => supabaseExpenseRepository.deleteExpense(expenseId),
    onSuccess: () => {
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: ['expenses', communityId] })
      }
    },
  })
}

export function useCreateSettlement(communityId: string | null | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateSettlementInput) =>
      supabaseExpenseRepository.createSettlement(input),
    onSuccess: () => {
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: ['settlements', communityId] })
      }
    },
  })
}

export function useDeleteSettlement(communityId: string | null | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (settlementId: string) => supabaseExpenseRepository.deleteSettlement(settlementId),
    onSuccess: () => {
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: ['settlements', communityId] })
      }
    },
  })
}
