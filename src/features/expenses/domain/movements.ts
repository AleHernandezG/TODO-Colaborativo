import type { Expense, Settlement } from './expense'

export type Movement =
  | { kind: 'expense'; id: string; at: string; expense: Expense }
  | { kind: 'settlement'; id: string; at: string; settlement: Settlement }

export type MovementDay = {
  day: string
  movements: Movement[]
}

export const unknownDay = 'unknown'

export function dayOf(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return unknownDay
  }
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function timeOf(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`
}

export function toMovements(expenses: Expense[], settlements: Settlement[]): Movement[] {
  const movements: Movement[] = [
    ...expenses.map((expense): Movement => ({
      kind: 'expense',
      id: expense.id,
      at: expense.createdAt,
      expense,
    })),
    ...settlements.map((settlement): Movement => ({
      kind: 'settlement',
      id: settlement.id,
      at: settlement.createdAt,
      settlement,
    })),
  ]

  return movements.sort((a, b) => {
    const timeA = new Date(a.at).getTime()
    const timeB = new Date(b.at).getTime()
    if (Number.isNaN(timeA)) return 1
    if (Number.isNaN(timeB)) return -1
    return timeB - timeA
  })
}

export function groupMovementsByDay(expenses: Expense[], settlements: Settlement[]): MovementDay[] {
  const days: MovementDay[] = []

  for (const movement of toMovements(expenses, settlements)) {
    const day = dayOf(movement.at)
    const current = days[days.length - 1]
    if (current && current.day === day) {
      current.movements.push(movement)
    } else {
      days.push({ day, movements: [movement] })
    }
  }

  return days
}
