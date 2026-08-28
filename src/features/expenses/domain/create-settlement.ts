import type { CreateSettlementInput, ExpenseRepository } from './expense-repository'
import { isValidAmountCents } from './money'

export async function createSettlement(
  repository: ExpenseRepository,
  input: CreateSettlementInput,
): Promise<void> {
  if (!isValidAmountCents(input.amountCents)) {
    throw new Error(`el importe de la liquidación no es válido: ${input.amountCents}`)
  }

  if (input.fromMemberId === input.toMemberId) {
    throw new Error('una liquidación no puede ir de un miembro a sí mismo')
  }

  await repository.createSettlement(input)
}
