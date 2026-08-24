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

    const { data, error } = await (supabase.from as any)('expenses')
      .select(
        'id, community_id, item_id, paid_by_member_id, created_by_auth_user_id, amount_cents, currency, description, created_at, updated_at, shares:expense_shares(id, expense_id, member_id, share_cents)',
      )
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`No se pudieron cargar los gastos: ${error.message}`)
    }

    return ((data as unknown as ExpenseRow[]) ?? []).map(mapExpenseRow)
  },

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    await assertOnline()

    const { data, error } = await (supabase.rpc as any)('create_expense_with_shares', {
      p_community_id: input.communityId,
      p_item_id: input.itemId ?? null,
      p_paid_by_member_id: input.paidByMemberId,
      p_amount_cents: input.amountCents,
      p_description: input.description,
      p_shares: input.shares.map((s) => ({
        member_id: s.memberId,
        share_cents: s.shareCents,
      })),
    })

    if (error) {
      throw new Error(`No se pudo registrar el gasto: ${error.message}`)
    }

    const expenseId = data as unknown as string

    // Leer el gasto completo recién creado
    const { data: createdRow, error: readError } = await (supabase.from as any)('expenses')
      .select(
        'id, community_id, item_id, paid_by_member_id, created_by_auth_user_id, amount_cents, currency, description, created_at, updated_at, shares:expense_shares(id, expense_id, member_id, share_cents)',
      )
      .eq('id', expenseId)
      .single()

    if (readError || !createdRow) {
      throw new Error(
        `El gasto se registró pero no se pudo leer: ${readError?.message ?? 'sin datos'}`,
      )
    }

    return mapExpenseRow(createdRow as unknown as ExpenseRow)
  },

  async deleteExpense(expenseId: string): Promise<void> {
    await assertOnline()

    const { error } = await (supabase.from as any)('expenses').delete().eq('id', expenseId)

    if (error) {
      throw new Error(`No se pudo eliminar el gasto: ${error.message}`)
    }
  },

  async listSettlements(communityId: string): Promise<Settlement[]> {
    await assertOnline()

    const { data, error } = await (supabase.from as any)('settlements')
      .select(
        'id, community_id, from_member_id, to_member_id, amount_cents, currency, created_by_auth_user_id, created_at',
      )
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`No se pudieron cargar las liquidaciones: ${error.message}`)
    }

    return ((data as unknown as SettlementRow[]) ?? []).map(mapSettlementRow)
  },

  async createSettlement(input: CreateSettlementInput): Promise<Settlement> {
    await assertOnline()

    const { data, error } = await (supabase.from as any)('settlements')
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
      throw new Error(`No se pudo registrar la liquidación: ${error?.message ?? 'sin datos'}`)
    }

    return mapSettlementRow(data as unknown as SettlementRow)
  },

  async deleteSettlement(settlementId: string): Promise<void> {
    await assertOnline()

    const { error } = await (supabase.from as any)('settlements').delete().eq('id', settlementId)

    if (error) {
      throw new Error(`No se pudo eliminar la liquidación: ${error.message}`)
    }
  },
}
