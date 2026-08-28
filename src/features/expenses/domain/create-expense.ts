import type { CreateExpenseInput, ExpenseRepository } from './expense-repository'
import { isValidAmountCents } from './money'

export async function createExpense(
  repository: ExpenseRepository,
  input: CreateExpenseInput,
): Promise<void> {
  if (!isValidAmountCents(input.amountCents)) {
    throw new Error(`el importe del gasto no es válido: ${input.amountCents}`)
  }

  if (!input.description.trim()) {
    throw new Error('un gasto necesita un concepto')
  }

  if (input.shares.length === 0) {
    throw new Error('un gasto necesita al menos un participante')
  }

  const sharesTotal = input.shares.reduce((total, share) => total + share.shareCents, 0)
  if (sharesTotal !== input.amountCents) {
    throw new Error(`las cuotas suman ${sharesTotal} y el gasto es de ${input.amountCents}`)
  }

  await repository.createExpense(input)
}
