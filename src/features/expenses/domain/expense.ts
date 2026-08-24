export type ExpenseShare = {
  id: string
  expenseId: string
  memberId: string
  shareCents: number
}

export type Expense = {
  id: string
  communityId: string
  itemId: string | null
  paidByMemberId: string
  createdByAuthUserId: string
  amountCents: number
  currency: string
  description: string
  createdAt: string
  updatedAt: string
  shares: ExpenseShare[]
}

export type Settlement = {
  id: string
  communityId: string
  fromMemberId: string
  toMemberId: string
  amountCents: number
  currency: string
  createdByAuthUserId: string
  createdAt: string
}

export type MemberBalance = {
  memberId: string
  username: string
  paidCents: number
  owedCents: number
  netBalanceCents: number
}

export type DebtTransfer = {
  fromMemberId: string
  fromUsername: string
  toMemberId: string
  toUsername: string
  amountCents: number
}
