import type { Expense, Settlement } from './expense'

export type CreateExpenseInput = {
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
  communityId: string
  fromMemberId: string
  toMemberId: string
  amountCents: number
  currency?: string
}

export interface ExpenseRepository {
  listExpenses(communityId: string): Promise<Expense[]>
  createExpense(input: CreateExpenseInput): Promise<Expense>
  deleteExpense(expenseId: string): Promise<void>
  listSettlements(communityId: string): Promise<Settlement[]>
  createSettlement(input: CreateSettlementInput): Promise<Settlement>
  deleteSettlement(settlementId: string): Promise<void>
}
