import { dehydrate, hydrate, onlineManager, QueryClient } from '@tanstack/react-query'

import { shouldPersistMutation } from '../../../../shared/lib/query-persister'
import { supabaseExpenseRepository } from '../../data/supabase-expense-repository'
import { expenseMutationKeys, registerExpenseMutationDefaults } from '../expense-mutations'

jest.mock('../../data/supabase-expense-repository', () => ({
  supabaseExpenseRepository: {
    listExpenses: jest.fn(),
    createExpense: jest.fn(),
    deleteExpense: jest.fn(),
    listSettlements: jest.fn(),
    createSettlement: jest.fn(),
    deleteSettlement: jest.fn(),
    subscribe: jest.fn(),
  },
}))

const repository = supabaseExpenseRepository as jest.Mocked<typeof supabaseExpenseRepository>

const clients: QueryClient[] = []

function newClient() {
  const client = new QueryClient()
  registerExpenseMutationDefaults(client)
  clients.push(client)
  return client
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function startPaused(client: QueryClient, mutationKey: readonly string[], variables: unknown) {
  const mutation = client
    .getMutationCache()
    .build(client, client.defaultMutationOptions({ mutationKey: [...mutationKey] }))

  void mutation.execute(variables).catch(() => undefined)
  return mutation
}

async function rehydrate(client: QueryClient) {
  const stored = dehydrate(client, {
    shouldDehydrateQuery: () => false,
    shouldDehydrateMutation: shouldPersistMutation,
  })

  const restored = newClient()
  hydrate(restored, JSON.parse(JSON.stringify(stored)))
  return { stored, restored }
}

const newExpense = {
  id: 'gasto-nuevo',
  communityId: 'c1',
  itemId: null,
  paidByMemberId: 'm1',
  amountCents: 1200,
  description: 'Compra semanal',
  shares: [
    { memberId: 'm1', shareCents: 600 },
    { memberId: 'm2', shareCents: 600 },
  ],
}

beforeEach(() => {
  jest.clearAllMocks()
  onlineManager.setOnline(true)
})

afterEach(() => {
  onlineManager.setOnline(true)
  clients.splice(0).forEach((client) => {
    client
      .getMutationCache()
      .getAll()
      .forEach((mutation) => {
        mutation.destroy()
      })
    client.clear()
  })
})

it('cada clave de mutación trae su función, que es lo que falta al rehidratar', () => {
  const client = newClient()

  for (const key of Object.values(expenseMutationKeys)) {
    expect(client.getMutationDefaults([...key]).mutationFn).toBeInstanceOf(Function)
  }
})

it('un gasto creado sin cobertura se rehidrata con su id y llega al servidor', async () => {
  onlineManager.setOnline(false)

  const client = newClient()
  startPaused(client, expenseMutationKeys.addExpense, newExpense)
  await settle()

  expect(repository.createExpense).not.toHaveBeenCalled()

  const { stored, restored } = await rehydrate(client)
  expect(stored.mutations).toHaveLength(1)

  onlineManager.setOnline(true)
  repository.createExpense.mockResolvedValue(undefined)

  await restored.resumePausedMutations()

  expect(repository.createExpense).toHaveBeenCalledWith(newExpense)
})

it('borrar un gasto sin cobertura llega al servidor al reanudar', async () => {
  onlineManager.setOnline(false)

  const client = newClient()
  startPaused(client, expenseMutationKeys.removeExpense, {
    communityId: 'c1',
    expenseId: 'gasto-1',
  })
  await settle()

  const { restored } = await rehydrate(client)

  onlineManager.setOnline(true)
  repository.deleteExpense.mockResolvedValue(undefined)

  await restored.resumePausedMutations()

  expect(repository.deleteExpense).toHaveBeenCalledWith('gasto-1')
})

it('una liquidación encolada conserva su id, así que reenviarla no la duplica', async () => {
  onlineManager.setOnline(false)

  const client = newClient()
  startPaused(client, expenseMutationKeys.addSettlement, {
    id: 'liquidacion-1',
    communityId: 'c1',
    fromMemberId: 'm1',
    toMemberId: 'm2',
    amountCents: 600,
  })
  startPaused(client, expenseMutationKeys.removeSettlement, {
    communityId: 'c1',
    settlementId: 'liquidacion-vieja',
  })
  await settle()

  const { stored, restored } = await rehydrate(client)
  expect(stored.mutations).toHaveLength(2)

  onlineManager.setOnline(true)
  repository.createSettlement.mockResolvedValue(undefined)
  repository.deleteSettlement.mockResolvedValue(undefined)

  await restored.resumePausedMutations()

  expect(repository.createSettlement).toHaveBeenCalledWith({
    id: 'liquidacion-1',
    communityId: 'c1',
    fromMemberId: 'm1',
    toMemberId: 'm2',
    amountCents: 600,
  })
  expect(repository.deleteSettlement).toHaveBeenCalledWith('liquidacion-vieja')
})
