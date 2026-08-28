import { serverError } from '../../../shared/lib/errors'
import { assertOnline } from '../../../shared/lib/network'
import { supabase } from '../../../shared/lib/supabase'
import type { Expense, Settlement } from '../domain/expense'
import type {
  CreateExpenseInput,
  CreateSettlementInput,
  ExpenseRepository,
} from '../domain/expense-repository'

const expenseColumns =
  'id, community_id, item_id, paid_by_member_id, created_by_auth_user_id, amount_cents, currency, description, created_at, updated_at, shares:expense_shares(id, expense_id, member_id, share_cents)'
const settlementColumns =
  'id, community_id, from_member_id, to_member_id, amount_cents, currency, created_by_auth_user_id, created_at'
const duplicateKey = '23505'

type ExpenseRow = {
  id: string
  community_id: string
  item_id: string | null
  paid_by_member_id: string
  created_by_auth_user_id: string
  amount_cents: number
  currency: string
  description: string
  created_at: string
  updated_at: string
  shares: {
    id: string
    expense_id: string
    member_id: string
    share_cents: number
  }[]
}

type SettlementRow = {
  id: string
  community_id: string
  from_member_id: string
  to_member_id: string
  amount_cents: number
  currency: string
  created_by_auth_user_id: string
  created_at: string
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    communityId: row.community_id,
    itemId: row.item_id,
    paidByMemberId: row.paid_by_member_id,
    createdByAuthUserId: row.created_by_auth_user_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    shares: (row.shares ?? []).map((share) => ({
      id: share.id,
      expenseId: share.expense_id,
      memberId: share.member_id,
      shareCents: share.share_cents,
    })),
  }
}

function toSettlement(row: SettlementRow): Settlement {
  return {
    id: row.id,
    communityId: row.community_id,
    fromMemberId: row.from_member_id,
    toMemberId: row.to_member_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    createdByAuthUserId: row.created_by_auth_user_id,
    createdAt: row.created_at,
  }
}

export const supabaseExpenseRepository: ExpenseRepository = {
  async listExpenses(communityId) {
    await assertOnline()

    const { data, error } = await supabase
      .from('expenses')
      .select(expenseColumns)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (error) {
      throw serverError('expenses.select', error)
    }

    return (data ?? []).map(toExpense)
  },

  async createExpense(input: CreateExpenseInput) {
    await assertOnline()

    const { error } = await supabase.rpc('create_expense_with_shares', {
      p_expense_id: input.id,
      p_community_id: input.communityId,
      p_item_id: (input.itemId ?? null) as unknown as string,
      p_paid_by_member_id: input.paidByMemberId,
      p_amount_cents: input.amountCents,
      p_description: input.description,
      p_shares: input.shares.map((share) => ({
        member_id: share.memberId,
        share_cents: share.shareCents,
      })),
    })

    if (error) {
      throw serverError('create_expense_with_shares', error)
    }
  },

  async deleteExpense(expenseId) {
    await assertOnline()

    const { error } = await supabase.from('expenses').delete().eq('id', expenseId)

    if (error) {
      throw serverError('expenses.delete', error)
    }
  },

  async listSettlements(communityId) {
    await assertOnline()

    const { data, error } = await supabase
      .from('settlements')
      .select(settlementColumns)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (error) {
      throw serverError('settlements.select', error)
    }

    return (data ?? []).map(toSettlement)
  },

  async createSettlement(input: CreateSettlementInput) {
    await assertOnline()

    const { error } = await supabase.from('settlements').insert({
      id: input.id,
      community_id: input.communityId,
      from_member_id: input.fromMemberId,
      to_member_id: input.toMemberId,
      amount_cents: input.amountCents,
      currency: input.currency ?? 'EUR',
    })

    if (error?.code === duplicateKey) {
      return
    }

    if (error) {
      throw serverError('settlements.insert', error)
    }
  },

  async deleteSettlement(settlementId) {
    await assertOnline()

    const { error } = await supabase.from('settlements').delete().eq('id', settlementId)

    if (error) {
      throw serverError('settlements.delete', error)
    }
  },

  subscribe(communityId, { onChange, onStatus }) {
    const filter = `community_id=eq.${communityId}`

    const channel = supabase
      .channel(`expenses:${communityId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter }, () =>
        onChange(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter }, () =>
        onChange(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          onStatus('connected')
          return
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          onStatus('disconnected')
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  },
}
