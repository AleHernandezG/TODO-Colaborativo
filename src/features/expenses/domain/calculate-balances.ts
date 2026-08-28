import type { DebtTransfer, Expense, MemberBalance, Settlement } from './expense'

export type MemberRef = {
  id: string
  username: string
}

export function calculateBalances(
  members: MemberRef[],
  expenses: Expense[],
  settlements: Settlement[],
): MemberBalance[] {
  const map = new Map<string, { username: string; paid: number; owed: number }>()

  for (const m of members) {
    map.set(m.id, { username: m.username, paid: 0, owed: 0 })
  }

  for (const expense of expenses) {
    const payer = map.get(expense.paidByMemberId)
    if (payer) {
      payer.paid += expense.amountCents
    }

    for (const share of expense.shares) {
      const debtor = map.get(share.memberId)
      if (debtor) {
        debtor.owed += share.shareCents
      }
    }
  }

  for (const settlement of settlements) {
    const from = map.get(settlement.fromMemberId)
    if (from) {
      from.paid += settlement.amountCents
    }

    const to = map.get(settlement.toMemberId)
    if (to) {
      to.owed += settlement.amountCents
    }
  }

  const result: MemberBalance[] = []
  for (const [memberId, data] of map.entries()) {
    result.push({
      memberId,
      username: data.username,
      paidCents: data.paid,
      owedCents: data.owed,
      netBalanceCents: data.paid - data.owed,
    })
  }

  return result
}

export function calculateMinTransfers(balances: MemberBalance[]): DebtTransfer[] {
  type Node = { memberId: string; username: string; amount: number }

  const debtors: Node[] = []
  const creditors: Node[] = []

  for (const b of balances) {
    if (b.netBalanceCents < 0) {
      debtors.push({ memberId: b.memberId, username: b.username, amount: -b.netBalanceCents })
    } else if (b.netBalanceCents > 0) {
      creditors.push({ memberId: b.memberId, username: b.username, amount: b.netBalanceCents })
    }
  }

  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  const transfers: DebtTransfer[] = []
  let dIdx = 0
  let cIdx = 0

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx]
    const creditor = creditors[cIdx]
    if (!debtor || !creditor) break

    const matchAmount = Math.min(debtor.amount, creditor.amount)

    if (matchAmount > 0) {
      transfers.push({
        fromMemberId: debtor.memberId,
        fromUsername: debtor.username,
        toMemberId: creditor.memberId,
        toUsername: creditor.username,
        amountCents: matchAmount,
      })

      debtor.amount -= matchAmount
      creditor.amount -= matchAmount
    }

    if (debtor.amount === 0) dIdx += 1
    if (creditor.amount === 0) cIdx += 1
  }

  return transfers
}
