import NetInfo from '@react-native-community/netinfo'

import { OfflineError } from '../../../../shared/lib/network'
import { supabase } from '../../../../shared/lib/supabase'
import { supabaseExpenseRepository } from '../supabase-expense-repository'

jest.mock('../../../../shared/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}))

const from = supabase.from as jest.Mock
const rpc = supabase.rpc as jest.Mock
const netInfoFetch = NetInfo.fetch as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  netInfoFetch.mockResolvedValue({ isConnected: true })
})

describe('sin conexión', () => {
  beforeEach(() => {
    netInfoFetch.mockResolvedValue({ isConnected: false })
  })

  it('no llega a llamar a listExpenses', async () => {
    await expect(supabaseExpenseRepository.listExpenses('c1')).rejects.toBeInstanceOf(OfflineError)
    expect(from).not.toHaveBeenCalled()
  })

  it('no llega a llamar a createExpense', async () => {
    await expect(
      supabaseExpenseRepository.createExpense({
        communityId: 'c1',
        paidByMemberId: 'm1',
        amountCents: 1000,
        description: 'Compra',
        shares: [{ memberId: 'm1', shareCents: 1000 }],
      }),
    ).rejects.toBeInstanceOf(OfflineError)
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('listExpenses', () => {
  it('mapea las filas y sus shares devueltas por Supabase', async () => {
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [
                {
                  id: 'e1',
                  community_id: 'c1',
                  item_id: null,
                  paid_by_member_id: 'm1',
                  created_by_auth_user_id: 'u1',
                  amount_cents: 1000,
                  currency: 'EUR',
                  description: 'Compra',
                  created_at: '2026-08-24T10:00:00Z',
                  updated_at: '2026-08-24T10:00:00Z',
                  shares: [
                    { id: 's1', expense_id: 'e1', member_id: 'm1', share_cents: 500 },
                    { id: 's2', expense_id: 'e1', member_id: 'm2', share_cents: 500 },
                  ],
                },
              ],
              error: null,
            }),
        }),
      }),
    })

    const expenses = await supabaseExpenseRepository.listExpenses('c1')

    expect(expenses).toEqual([
      {
        id: 'e1',
        communityId: 'c1',
        itemId: null,
        paidByMemberId: 'm1',
        createdByAuthUserId: 'u1',
        amountCents: 1000,
        currency: 'EUR',
        description: 'Compra',
        createdAt: '2026-08-24T10:00:00Z',
        updatedAt: '2026-08-24T10:00:00Z',
        shares: [
          { id: 's1', expenseId: 'e1', memberId: 'm1', shareCents: 500 },
          { id: 's2', expenseId: 'e1', memberId: 'm2', shareCents: 500 },
        ],
      },
    ])
  })
})

describe('createExpense', () => {
  it('llama a la RPC atómica create_expense_with_shares y lee el resultado', async () => {
    rpc.mockResolvedValue({ data: 'e1', error: null })
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: 'e1',
                community_id: 'c1',
                item_id: null,
                paid_by_member_id: 'm1',
                created_by_auth_user_id: 'u1',
                amount_cents: 1000,
                currency: 'EUR',
                description: 'Compra',
                created_at: '2026-08-24T10:00:00Z',
                updated_at: '2026-08-24T10:00:00Z',
                shares: [{ id: 's1', expense_id: 'e1', member_id: 'm1', share_cents: 1000 }],
              },
              error: null,
            }),
        }),
      }),
    })

    const result = await supabaseExpenseRepository.createExpense({
      communityId: 'c1',
      paidByMemberId: 'm1',
      amountCents: 1000,
      description: 'Compra',
      shares: [{ memberId: 'm1', shareCents: 1000 }],
    })

    expect(rpc).toHaveBeenCalledWith('create_expense_with_shares', {
      p_community_id: 'c1',
      p_item_id: null,
      p_paid_by_member_id: 'm1',
      p_amount_cents: 1000,
      p_description: 'Compra',
      p_shares: [{ member_id: 'm1', share_cents: 1000 }],
    })
    expect(result.id).toBe('e1')
  })
})
