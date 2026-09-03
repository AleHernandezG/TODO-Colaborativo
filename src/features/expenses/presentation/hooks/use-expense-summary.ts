import { useMemo } from 'react'

import { useCommunityMembers } from '@/features/community'

import { calculateBalances, calculateMinTransfers } from '../../domain/calculate-balances'
import type { DebtTransfer, MemberBalance } from '../../domain/expense'
import { useExpenses } from './use-expenses'
import { useSettlements } from './use-settlements'

export type ExpenseSummary = {
  balances: MemberBalance[]
  transfers: DebtTransfer[]
  myBalance: MemberBalance | null
  totalSpentCents: number
  isLoading: boolean
  isError: boolean
}

export function useExpenseSummary(communityId: string): ExpenseSummary {
  const {
    data: members = [],
    isLoading: loadingMembers,
    isError: errorMembers,
  } = useCommunityMembers(communityId)
  const {
    data: expenses = [],
    isLoading: loadingExpenses,
    isError: errorExpenses,
  } = useExpenses(communityId)
  const {
    data: settlements = [],
    isLoading: loadingSettlements,
    isError: errorSettlements,
  } = useSettlements(communityId)

  const isLoading = loadingMembers || loadingExpenses || loadingSettlements
  const isError = errorMembers || errorExpenses || errorSettlements

  const balances = useMemo(() => {
    return calculateBalances(members, expenses, settlements)
  }, [members, expenses, settlements])

  const transfers = useMemo(() => {
    return calculateMinTransfers(balances)
  }, [balances])

  const myMember = members.find((m) => m.isSelf)
  const myBalance = useMemo(() => {
    if (!myMember) return null
    return balances.find((b) => b.memberId === myMember.id) ?? null
  }, [balances, myMember])

  const totalSpentCents = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amountCents, 0)
  }, [expenses])

  return {
    balances,
    transfers,
    myBalance,
    totalSpentCents,
    isLoading,
    isError,
  }
}
