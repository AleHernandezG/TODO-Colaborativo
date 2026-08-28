import type { Expense, Settlement } from './expense'

export type CreateExpenseInput = {
  id: string
  communityId: string
  itemId?: string | null
  paidByMemberId: string
  amountCents: number
  currency?: string
  description: string
  shares: {
    memberId: string
    shareCents: number
  }[]
}

export type CreateSettlementInput = {
  id: string
  communityId: string
  fromMemberId: string
  toMemberId: string
  amountCents: number
  currency?: string
}

export type ExpensesChannelStatus = 'connecting' | 'connected' | 'disconnected'

export type ExpensesSubscriptionHandlers = {
  onChange: () => void
  onStatus: (status: ExpensesChannelStatus) => void
}

export interface ExpenseRepository {
  listExpenses(communityId: string): Promise<Expense[]>
  createExpense(input: CreateExpenseInput): Promise<void>
  deleteExpense(expenseId: string): Promise<void>
  listSettlements(communityId: string): Promise<Settlement[]>
  createSettlement(input: CreateSettlementInput): Promise<void>
  deleteSettlement(settlementId: string): Promise<void>
  subscribe(communityId: string, handlers: ExpensesSubscriptionHandlers): () => void
}
