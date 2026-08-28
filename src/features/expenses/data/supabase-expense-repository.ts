import { ServerError, serverError } from '../../../shared/lib/errors'
import { assertOnline } from '../../../shared/lib/network'
import { supabase } from '../../../shared/lib/supabase'
import type { Expense, Settlement } from '../domain/expense'
import type {
  CreateExpenseInput,
  CreateSettlementInput,
  ExpenseRepository,
} from '../domain/expense-repository'

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

function mapExpenseRow(row: ExpenseRow): Expense {
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
    shares: (row.shares ?? []).map((s) => ({
      id: s.id,
      expenseId: s.expense_id,
      memberId: s.member_id,
      shareCents: s.share_cents,
    })),
  }
}

function mapSettlementRow(row: SettlementRow): Settlement {
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
  async listExpenses(communityId: string): Promise<Expense[]> {
    await assertOnline()

    const { data, error } = await supabase
      .from('expenses')
      .select(
        'id, community_id, item_id, paid_by_member_id, created_by_auth_user_id, amount_cents, currency, description, created_at, updated_at, shares:expense_shares(id, expense_id, member_id, share_cents)',
      )
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (error) {
      throw serverError('expenses.select', error)
    }

    return (data ?? []).map(mapExpenseRow)
  },

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    await assertOnline()

    const { data, error } = await supabase.rpc('create_expense_with_shares', {
      p_community_id: input.communityId,
      p_item_id: (input.itemId ?? null) as unknown as string,
      p_paid_by_member_id: input.paidByMemberId,
      p_amount_cents: input.amountCents,
      p_description: input.description,
      p_shares: input.shares.map((s) => ({
        member_id: s.memberId,
        share_cents: s.shareCents,
      })),
    })

    if (error) {
      throw serverError('create_expense_with_shares', error)
    }

    const expenseId = data

    const { data: createdRow, error: readError } = await supabase
      .from('expenses')
      .select(
        'id, community_id, item_id, paid_by_member_id, created_by_auth_user_id, amount_cents, currency, description, created_at, updated_at, shares:expense_shares(id, expense_id, member_id, share_cents)',
      )
      .eq('id', expenseId)
      .single()

    if (readError || !createdRow) {
      throw readError
        ? serverError('expenses.selectCreated', readError)
        : new ServerError('expenses.selectCreated', 'sin datos')
    }

    return mapExpenseRow(createdRow)
  },

  async deleteExpense(expenseId: string): Promise<void> {
    await assertOnline()

    const { error } = await supabase.from('expenses').delete().eq('id', expenseId)

    if (error) {
      throw serverError('expenses.delete', error)
    }
  },

  async listSettlements(communityId: string): Promise<Settlement[]> {
    await assertOnline()

    const { data, error } = await supabase
      .from('settlements')
      .select(
        'id, community_id, from_member_id, to_member_id, amount_cents, currency, created_by_auth_user_id, created_at',
      )
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (error) {
      throw serverError('settlements.select', error)
    }

    return (data ?? []).map(mapSettlementRow)
  },

  async createSettlement(input: CreateSettlementInput): Promise<Settlement> {
    await assertOnline()

    const { data, error } = await supabase
      .from('settlements')
      .insert({
        community_id: input.communityId,
        from_member_id: input.fromMemberId,
        to_member_id: input.toMemberId,
        amount_cents: input.amountCents,
        currency: input.currency ?? 'EUR',
      })
      .select(
        'id, community_id, from_member_id, to_member_id, amount_cents, currency, created_by_auth_user_id, created_at',
      )
      .single()

    if (error || !data) {
      throw error
        ? serverError('settlements.insert', error)
        : new ServerError('settlements.insert', 'sin datos')
    }

    return mapSettlementRow(data)
  },

  async deleteSettlement(settlementId: string): Promise<void> {
    await assertOnline()

    const { error } = await supabase.from('settlements').delete().eq('id', settlementId)

    if (error) {
      throw serverError('settlements.delete', error)
    }
  },
}
