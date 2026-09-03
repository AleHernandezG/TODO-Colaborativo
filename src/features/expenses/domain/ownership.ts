import type { Expense, Settlement } from './expense'

export function isOwnExpense(expense: Expense, authUserId: string | null): boolean {
  return authUserId !== null && authUserId !== '' && expense.createdByAuthUserId === authUserId
}

export function isOwnSettlement(settlement: Settlement, authUserId: string | null): boolean {
  return authUserId !== null && authUserId !== '' && settlement.createdByAuthUserId === authUserId
}
