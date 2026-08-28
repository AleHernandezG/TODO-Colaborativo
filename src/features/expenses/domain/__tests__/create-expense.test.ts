import { createExpense } from '../create-expense'
import { createSettlement } from '../create-settlement'
import type { CreateExpenseInput, ExpenseRepository } from '../expense-repository'

function fakeRepository(): jest.Mocked<ExpenseRepository> {
  return {
    listExpenses: jest.fn(),
    createExpense: jest.fn().mockResolvedValue(undefined),
    deleteExpense: jest.fn(),
    listSettlements: jest.fn(),
    createSettlement: jest.fn().mockResolvedValue(undefined),
    deleteSettlement: jest.fn(),
    subscribe: jest.fn(),
  }
}

const input: CreateExpenseInput = {
  id: 'e1',
  communityId: 'c1',
  paidByMemberId: 'm1',
  amountCents: 1000,
  description: 'Compra semanal',
  shares: [
    { memberId: 'm1', shareCents: 500 },
    { memberId: 'm2', shareCents: 500 },
  ],
}

describe('createExpense', () => {
  it('llega al repositorio con el id que trae de fuera', async () => {
    const repository = fakeRepository()

    await createExpense(repository, input)

    expect(repository.createExpense).toHaveBeenCalledWith(input)
  })

  it('rechaza un importe que no sea un entero positivo de céntimos', async () => {
    const repository = fakeRepository()

    await expect(createExpense(repository, { ...input, amountCents: 0 })).rejects.toThrow()
    await expect(createExpense(repository, { ...input, amountCents: -5 })).rejects.toThrow()
    await expect(createExpense(repository, { ...input, amountCents: 10.5 })).rejects.toThrow()
    expect(repository.createExpense).not.toHaveBeenCalled()
  })

  it('rechaza un concepto vacío', async () => {
    const repository = fakeRepository()

    await expect(createExpense(repository, { ...input, description: '   ' })).rejects.toThrow()
    expect(repository.createExpense).not.toHaveBeenCalled()
  })

  it('rechaza un gasto sin participantes', async () => {
    const repository = fakeRepository()

    await expect(createExpense(repository, { ...input, shares: [] })).rejects.toThrow()
    expect(repository.createExpense).not.toHaveBeenCalled()
  })

  it('rechaza unas cuotas que no suman el importe', async () => {
    const repository = fakeRepository()
    const shares = [
      { memberId: 'm1', shareCents: 500 },
      { memberId: 'm2', shareCents: 499 },
    ]

    await expect(createExpense(repository, { ...input, shares })).rejects.toThrow()
    expect(repository.createExpense).not.toHaveBeenCalled()
  })
})

describe('createSettlement', () => {
  const settlement = {
    id: 's1',
    communityId: 'c1',
    fromMemberId: 'm1',
    toMemberId: 'm2',
    amountCents: 500,
  }

  it('llega al repositorio con el id que trae de fuera', async () => {
    const repository = fakeRepository()

    await createSettlement(repository, settlement)

    expect(repository.createSettlement).toHaveBeenCalledWith(settlement)
  })

  it('rechaza un importe inválido', async () => {
    const repository = fakeRepository()

    await expect(createSettlement(repository, { ...settlement, amountCents: 0 })).rejects.toThrow()
    expect(repository.createSettlement).not.toHaveBeenCalled()
  })

  it('rechaza pagarse a uno mismo', async () => {
    const repository = fakeRepository()

    await expect(
      createSettlement(repository, { ...settlement, toMemberId: 'm1' }),
    ).rejects.toThrow()
    expect(repository.createSettlement).not.toHaveBeenCalled()
  })
})
