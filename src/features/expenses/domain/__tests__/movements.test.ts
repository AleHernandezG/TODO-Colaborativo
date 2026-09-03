import type { Expense, Settlement } from '../expense'
import { dayOf, groupMovementsByDay, timeOf, toMovements, unknownDay } from '../movements'

function expense(id: string, createdAt: string): Expense {
  return {
    id,
    communityId: 'c1',
    itemId: null,
    paidByMemberId: 'm1',
    createdByAuthUserId: 'u1',
    amountCents: 1000,
    currency: 'EUR',
    description: id,
    createdAt,
    updatedAt: createdAt,
    shares: [],
  }
}

function settlement(id: string, createdAt: string): Settlement {
  return {
    id,
    communityId: 'c1',
    fromMemberId: 'm1',
    toMemberId: 'm2',
    amountCents: 500,
    currency: 'EUR',
    createdByAuthUserId: 'u1',
    createdAt,
  }
}

it('mezcla gastos y liquidaciones del más nuevo al más viejo', () => {
  const movements = toMovements(
    [expense('e1', '2026-09-01T10:00:00.000Z'), expense('e2', '2026-09-03T10:00:00.000Z')],
    [settlement('s1', '2026-09-02T10:00:00.000Z')],
  )

  expect(movements.map((m) => m.id)).toEqual(['e2', 's1', 'e1'])
  expect(movements.map((m) => m.kind)).toEqual(['expense', 'settlement', 'expense'])
})

it('ordena bien aunque las fechas lleguen con husos distintos', () => {
  const movements = toMovements(
    [expense('utc', '2026-09-01T12:00:00.000Z'), expense('offset', '2026-09-01T14:30:00+00:00')],
    [],
  )

  expect(movements.map((m) => m.id)).toEqual(['offset', 'utc'])
})

it('una fecha ilegible cae al final en vez de romper el orden', () => {
  const movements = toMovements(
    [expense('roto', 'no es una fecha'), expense('bueno', '2026-09-01T10:00:00.000Z')],
    [],
  )

  expect(movements.map((m) => m.id)).toEqual(['bueno', 'roto'])
})

it('agrupa por día local conservando el orden', () => {
  const days = groupMovementsByDay(
    [
      expense('mañana', '2026-09-02T08:00:00.000Z'),
      expense('tarde', '2026-09-02T18:00:00.000Z'),
      expense('ayer', '2026-09-01T09:00:00.000Z'),
    ],
    [],
  )

  expect(days).toHaveLength(2)
  expect(days[0].movements.map((m) => m.id)).toEqual(['tarde', 'mañana'])
  expect(days[1].movements.map((m) => m.id)).toEqual(['ayer'])
})

it('sin movimientos no hay días', () => {
  expect(groupMovementsByDay([], [])).toEqual([])
})

it('dayOf y timeOf rellenan con ceros y marcan lo ilegible', () => {
  const date = new Date(2026, 8, 5, 7, 4)

  expect(dayOf(date.toISOString())).toBe('2026-09-05')
  expect(timeOf(date.toISOString())).toBe('07:04')
  expect(dayOf('ni idea')).toBe(unknownDay)
  expect(timeOf('ni idea')).toBe('')
})
