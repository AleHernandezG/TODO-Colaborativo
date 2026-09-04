import { calculateBalances, calculateMinTransfers } from '../calculate-balances'
import type { Expense, Settlement } from '../expense'

describe('calculateBalances', () => {
  const members = [
    { id: 'm1', username: 'Ana' },
    { id: 'm2', username: 'Bruno' },
    { id: 'm3', username: 'Carla' },
  ]

  it('calcula balances cuando una persona paga y se reparte entre tres', () => {
    const expenses: Expense[] = [
      {
        id: 'e1',
        communityId: 'c1',
        itemId: null,
        paidByMemberId: 'm1',
        createdByAuthUserId: 'u1',
        amountCents: 3000,
        currency: 'EUR',
        description: 'Compra semanal',
        createdAt: '2026-08-24T10:00:00Z',
        updatedAt: '2026-08-24T10:00:00Z',
        shares: [
          { id: 's1', expenseId: 'e1', memberId: 'm1', shareCents: 1000 },
          { id: 's2', expenseId: 'e1', memberId: 'm2', shareCents: 1000 },
          { id: 's3', expenseId: 'e1', memberId: 'm3', shareCents: 1000 },
        ],
      },
    ]

    const balances = calculateBalances(members, expenses, [])

    expect(balances).toEqual([
      { memberId: 'm1', username: 'Ana', paidCents: 3000, owedCents: 1000, netBalanceCents: 2000 },
      { memberId: 'm2', username: 'Bruno', paidCents: 0, owedCents: 1000, netBalanceCents: -1000 },
      { memberId: 'm3', username: 'Carla', paidCents: 0, owedCents: 1000, netBalanceCents: -1000 },
    ])
  })

  it('tiene en cuenta las liquidaciones (settlements)', () => {
    const expenses: Expense[] = [
      {
        id: 'e1',
        communityId: 'c1',
        itemId: null,
        paidByMemberId: 'm1',
        createdByAuthUserId: 'u1',
        amountCents: 2000,
        currency: 'EUR',
        description: 'Pizzas',
        createdAt: '2026-08-24T10:00:00Z',
        updatedAt: '2026-08-24T10:00:00Z',
        shares: [
          { id: 's1', expenseId: 'e1', memberId: 'm1', shareCents: 1000 },
          { id: 's2', expenseId: 'e1', memberId: 'm2', shareCents: 1000 },
        ],
      },
    ]

    // Bruno le paga 10€ a Ana para saldar su parte
    const settlements: Settlement[] = [
      {
        id: 'set1',
        communityId: 'c1',
        fromMemberId: 'm2',
        toMemberId: 'm1',
        amountCents: 1000,
        currency: 'EUR',
        createdByAuthUserId: 'u2',
        createdAt: '2026-08-24T12:00:00Z',
      },
    ]

    const balances = calculateBalances(members, expenses, settlements)

    expect(balances).toEqual([
      { memberId: 'm1', username: 'Ana', paidCents: 2000, owedCents: 2000, netBalanceCents: 0 },
      { memberId: 'm2', username: 'Bruno', paidCents: 1000, owedCents: 1000, netBalanceCents: 0 },
      { memberId: 'm3', username: 'Carla', paidCents: 0, owedCents: 0, netBalanceCents: 0 },
    ])
  })

  it('incluye miembros archivados si su saldo pendiente es distinto de cero', () => {
    const membersWithArchived = [
      { id: 'm1', username: 'Ana' },
      { id: 'm2', username: 'Bruno', removedAt: '2026-09-04T12:00:00Z' },
    ]

    const expenses: Expense[] = [
      {
        id: 'e1',
        communityId: 'c1',
        itemId: null,
        paidByMemberId: 'm1',
        createdByAuthUserId: 'u1',
        amountCents: 2000,
        currency: 'EUR',
        description: 'Compra compartida',
        createdAt: '2026-08-24T10:00:00Z',
        updatedAt: '2026-08-24T10:00:00Z',
        shares: [
          { id: 's1', expenseId: 'e1', memberId: 'm1', shareCents: 1000 },
          { id: 's2', expenseId: 'e1', memberId: 'm2', shareCents: 1000 },
        ],
      },
    ]

    const balances = calculateBalances(membersWithArchived, expenses, [])

    expect(balances).toEqual([
      { memberId: 'm1', username: 'Ana', paidCents: 2000, owedCents: 1000, netBalanceCents: 1000 },
      { memberId: 'm2', username: 'Bruno', paidCents: 0, owedCents: 1000, netBalanceCents: -1000 },
    ])
  })

  it('omite miembros archivados cuyo saldo es exactamente cero', () => {
    const membersWithArchived = [
      { id: 'm1', username: 'Ana' },
      { id: 'm2', username: 'Bruno', removedAt: '2026-09-04T12:00:00Z' },
    ]

    const expenses: Expense[] = [
      {
        id: 'e1',
        communityId: 'c1',
        itemId: null,
        paidByMemberId: 'm1',
        createdByAuthUserId: 'u1',
        amountCents: 2000,
        currency: 'EUR',
        description: 'Compra compartida',
        createdAt: '2026-08-24T10:00:00Z',
        updatedAt: '2026-08-24T10:00:00Z',
        shares: [
          { id: 's1', expenseId: 'e1', memberId: 'm1', shareCents: 1000 },
          { id: 's2', expenseId: 'e1', memberId: 'm2', shareCents: 1000 },
        ],
      },
    ]

    const settlements: Settlement[] = [
      {
        id: 'set1',
        communityId: 'c1',
        fromMemberId: 'm2',
        toMemberId: 'm1',
        amountCents: 1000,
        currency: 'EUR',
        createdByAuthUserId: 'u2',
        createdAt: '2026-08-24T12:00:00Z',
      },
    ]

    const balances = calculateBalances(membersWithArchived, expenses, settlements)

    // Bruno está archivado y saldo = 0, por lo que no aparece en balances
    expect(balances).toEqual([
      { memberId: 'm1', username: 'Ana', paidCents: 2000, owedCents: 2000, netBalanceCents: 0 },
    ])
  })
})

describe('calculateMinTransfers', () => {
  it('genera la transferencia directa si hay 1 deudor y 1 acreedor', () => {
    const balances = [
      { memberId: 'm1', username: 'Ana', paidCents: 2000, owedCents: 1000, netBalanceCents: 1000 },
      { memberId: 'm2', username: 'Bruno', paidCents: 0, owedCents: 1000, netBalanceCents: -1000 },
    ]

    const transfers = calculateMinTransfers(balances)

    expect(transfers).toEqual([
      {
        fromMemberId: 'm2',
        fromUsername: 'Bruno',
        toMemberId: 'm1',
        toUsername: 'Ana',
        amountCents: 1000,
      },
    ])
  })

  it('resuelve transferencias entre múltiples personas de forma óptima', () => {
    // Ana: +20€, Bruno: -10€, Carla: -10€
    const balances = [
      { memberId: 'm1', username: 'Ana', paidCents: 3000, owedCents: 1000, netBalanceCents: 2000 },
      { memberId: 'm2', username: 'Bruno', paidCents: 0, owedCents: 1000, netBalanceCents: -1000 },
      { memberId: 'm3', username: 'Carla', paidCents: 0, owedCents: 1000, netBalanceCents: -1000 },
    ]

    const transfers = calculateMinTransfers(balances)

    expect(transfers).toEqual([
      {
        fromMemberId: 'm2',
        fromUsername: 'Bruno',
        toMemberId: 'm1',
        toUsername: 'Ana',
        amountCents: 1000,
      },
      {
        fromMemberId: 'm3',
        fromUsername: 'Carla',
        toMemberId: 'm1',
        toUsername: 'Ana',
        amountCents: 1000,
      },
    ])
  })

  it('no devuelve transferencias si todos los balances están a 0', () => {
    const balances = [
      { memberId: 'm1', username: 'Ana', paidCents: 1000, owedCents: 1000, netBalanceCents: 0 },
      { memberId: 'm2', username: 'Bruno', paidCents: 1000, owedCents: 1000, netBalanceCents: 0 },
    ]

    expect(calculateMinTransfers(balances)).toEqual([])
  })
})
