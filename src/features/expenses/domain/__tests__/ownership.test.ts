import type { Expense, Settlement } from '../expense'
import { isOwnExpense, isOwnSettlement } from '../ownership'

const expense = {
  id: 'e1',
  communityId: 'c1',
  itemId: null,
  paidByMemberId: 'm1',
  createdByAuthUserId: 'u1',
  amountCents: 1000,
  currency: 'EUR',
  description: 'Compra',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  shares: [],
} satisfies Expense

const settlement = {
  id: 's1',
  communityId: 'c1',
  fromMemberId: 'm1',
  toMemberId: 'm2',
  amountCents: 500,
  currency: 'EUR',
  createdByAuthUserId: 'u1',
  createdAt: '2026-09-01T10:00:00.000Z',
} satisfies Settlement

it('es tuyo lo que creaste tú', () => {
  expect(isOwnExpense(expense, 'u1')).toBe(true)
  expect(isOwnSettlement(settlement, 'u1')).toBe(true)
})

it('no es tuyo lo que creó otro', () => {
  expect(isOwnExpense(expense, 'u2')).toBe(false)
  expect(isOwnSettlement(settlement, 'u2')).toBe(false)
})

it('sin sesión nada es tuyo, ni aunque el creador venga vacío', () => {
  expect(isOwnExpense(expense, null)).toBe(false)
  expect(isOwnExpense({ ...expense, createdByAuthUserId: '' }, '')).toBe(false)
  expect(isOwnSettlement({ ...settlement, createdByAuthUserId: '' }, '')).toBe(false)
})
