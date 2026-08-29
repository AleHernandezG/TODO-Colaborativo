import NetInfo from '@react-native-community/netinfo'

import { OfflineError } from '@/shared/lib/network'
import { supabase } from '@/shared/lib/supabase'

import { supabaseExpenseRepository } from '../supabase-expense-repository'

jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}))

const from = supabase.from as jest.Mock
const rpc = supabase.rpc as jest.Mock
const channel = supabase.channel as jest.Mock
const removeChannel = supabase.removeChannel as jest.Mock
const netInfoFetch = NetInfo.fetch as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  netInfoFetch.mockResolvedValue({ isConnected: true })
})

const newExpense = {
  id: 'e1',
  communityId: 'c1',
  paidByMemberId: 'm1',
  amountCents: 1000,
  description: 'Compra',
  shares: [{ memberId: 'm1', shareCents: 1000 }],
}

const newSettlement = {
  id: 's1',
  communityId: 'c1',
  fromMemberId: 'm1',
  toMemberId: 'm2',
  amountCents: 500,
}

function fakeChannel() {
  const handlers: { table: string; filter: string }[] = []
  let statusListener: ((status: string) => void) | undefined

  const built: { on: jest.Mock; subscribe: jest.Mock } = {
    on: jest.fn((_event: string, config: { table: string; filter: string }) => {
      handlers.push({ table: config.table, filter: config.filter })
      return built
    }),
    subscribe: jest.fn((listener: (status: string) => void) => {
      statusListener = listener
      return built
    }),
  }

  channel.mockReturnValue(built)
  return { built, handlers, emitStatus: (status: string) => statusListener?.(status) }
}

describe('sin conexion', () => {
  beforeEach(() => {
    netInfoFetch.mockResolvedValue({ isConnected: false })
  })

  it('no llega a llamar a listExpenses', async () => {
    await expect(supabaseExpenseRepository.listExpenses('c1')).rejects.toBeInstanceOf(OfflineError)
    expect(from).not.toHaveBeenCalled()
  })

  it('no llega a llamar a createExpense', async () => {
    await expect(supabaseExpenseRepository.createExpense(newExpense)).rejects.toBeInstanceOf(
      OfflineError,
    )
    expect(rpc).not.toHaveBeenCalled()
  })

  it('suscribirse no depende de la red', () => {
    fakeChannel()

    supabaseExpenseRepository.subscribe('c1', { onChange: jest.fn(), onStatus: jest.fn() })

    expect(channel).toHaveBeenCalledWith('expenses:c1')
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
  it('manda el id del cliente a la RPC atomica', async () => {
    rpc.mockResolvedValue({ data: 'e1', error: null })

    await supabaseExpenseRepository.createExpense(newExpense)

    expect(rpc).toHaveBeenCalledWith('create_expense_with_shares', {
      p_expense_id: 'e1',
      p_community_id: 'c1',
      p_item_id: null,
      p_paid_by_member_id: 'm1',
      p_amount_cents: 1000,
      p_description: 'Compra',
      p_shares: [{ member_id: 'm1', share_cents: 1000 }],
    })
  })

  it('no vuelve a leer el gasto despues de escribirlo', async () => {
    rpc.mockResolvedValue({ data: 'e1', error: null })

    await supabaseExpenseRepository.createExpense(newExpense)

    expect(from).not.toHaveBeenCalled()
  })

  it('envuelve el error de la RPC con su operacion y su codigo', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'sin permiso', code: '42501' } })

    await expect(supabaseExpenseRepository.createExpense(newExpense)).rejects.toThrow(
      'create_expense_with_shares: sin permiso [42501]',
    )
  })
})

describe('createSettlement', () => {
  it('manda el id del cliente y la moneda por defecto', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null })
    from.mockReturnValue({ insert })

    await supabaseExpenseRepository.createSettlement(newSettlement)

    expect(insert).toHaveBeenCalledWith({
      id: 's1',
      community_id: 'c1',
      from_member_id: 'm1',
      to_member_id: 'm2',
      amount_cents: 500,
      currency: 'EUR',
    })
  })

  it('un id repetido significa que ya se habia guardado', async () => {
    from.mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } }),
    })

    await expect(supabaseExpenseRepository.createSettlement(newSettlement)).resolves.toBeUndefined()
  })
})

describe('subscribe', () => {
  it('escucha gastos y liquidaciones filtrando por comunidad', () => {
    const { handlers } = fakeChannel()

    supabaseExpenseRepository.subscribe('c1', { onChange: jest.fn(), onStatus: jest.fn() })

    expect(handlers).toEqual([
      { table: 'expenses', filter: 'community_id=eq.c1' },
      { table: 'settlements', filter: 'community_id=eq.c1' },
    ])
  })

  it('traduce los estados del canal a los del dominio', () => {
    const { emitStatus } = fakeChannel()
    const onStatus = jest.fn()

    supabaseExpenseRepository.subscribe('c1', { onChange: jest.fn(), onStatus })

    emitStatus('SUBSCRIBED')
    emitStatus('CHANNEL_ERROR')
    emitStatus('CLOSED')

    expect(onStatus.mock.calls.flat()).toEqual(['connected', 'disconnected', 'disconnected'])
  })

  it('la baja cierra el canal', () => {
    const { built } = fakeChannel()

    const unsubscribe = supabaseExpenseRepository.subscribe('c1', {
      onChange: jest.fn(),
      onStatus: jest.fn(),
    })
    unsubscribe()

    expect(removeChannel).toHaveBeenCalledWith(built)
  })
})
