import { dehydrate, hydrate, onlineManager, QueryClient } from '@tanstack/react-query'

import { shouldPersistMutation } from '../../../../shared/lib/query-persister'
import { supabaseItemRepository } from '../../data/supabase-item-repository'
import { itemMutationKeys, registerItemMutationDefaults } from '../item-mutations'

jest.mock('../../data/supabase-item-repository', () => ({
  supabaseItemRepository: {
    add: jest.fn(),
    setPurchased: jest.fn(),
    edit: jest.fn(),
    remove: jest.fn(),
    removeImage: jest.fn(),
    uploadImage: jest.fn(),
  },
}))

const repository = supabaseItemRepository as jest.Mocked<typeof supabaseItemRepository>

const clients: QueryClient[] = []

function newClient() {
  const client = new QueryClient()
  registerItemMutationDefaults(client)
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

  for (const key of Object.values(itemMutationKeys)) {
    expect(client.getMutationDefaults([...key]).mutationFn).toBeInstanceOf(Function)
  }
})

it('un alta sin conexión se guarda, se rehidrata en otro cliente y llega al servidor', async () => {
  onlineManager.setOnline(false)

  const client = newClient()
  startPaused(client, itemMutationKeys.add, {
    id: 'item-nuevo',
    communityId: 'c1',
    name: 'Pan',
    quantity: 2,
  })
  await settle()

  expect(repository.add).not.toHaveBeenCalled()

  const stored = dehydrate(client, {
    shouldDehydrateQuery: () => false,
    shouldDehydrateMutation: shouldPersistMutation,
  })
  expect(stored.mutations).toHaveLength(1)

  const restored = newClient()
  hydrate(restored, JSON.parse(JSON.stringify(stored)))

  onlineManager.setOnline(true)
  repository.add.mockResolvedValue({
    id: 'item-nuevo',
    name: 'Pan',
    quantity: 2,
    isPurchased: false,
    imagePath: null,
    createdAt: '2026-08-04T10:00:00.000Z',
  })

  await restored.resumePausedMutations()

  expect(repository.add).toHaveBeenCalledWith({
    id: 'item-nuevo',
    communityId: 'c1',
    name: 'Pan',
    quantity: 2,
  })
})

it('marcar un artículo añadido sin cobertura llega al servidor con el mismo id', async () => {
  onlineManager.setOnline(false)

  const client = newClient()
  startPaused(client, itemMutationKeys.add, {
    id: 'item-nuevo',
    communityId: 'c1',
    name: 'Pan',
    quantity: 2,
  })
  startPaused(client, itemMutationKeys.togglePurchased, {
    communityId: 'c1',
    item: {
      id: 'item-nuevo',
      name: 'Pan',
      quantity: 2,
      isPurchased: false,
      imagePath: null,
      createdAt: '2026-08-04T10:00:00.000Z',
    },
  })
  await settle()

  const stored = dehydrate(client, {
    shouldDehydrateQuery: () => false,
    shouldDehydrateMutation: shouldPersistMutation,
  })
  expect(stored.mutations).toHaveLength(2)

  const restored = newClient()
  hydrate(restored, JSON.parse(JSON.stringify(stored)))

  onlineManager.setOnline(true)
  repository.add.mockResolvedValue({
    id: 'item-nuevo',
    name: 'Pan',
    quantity: 2,
    isPurchased: false,
    imagePath: null,
    createdAt: '2026-08-04T10:00:00.000Z',
  })
  repository.setPurchased.mockResolvedValue(undefined)

  await restored.resumePausedMutations()

  expect(repository.add).toHaveBeenCalledWith({
    id: 'item-nuevo',
    communityId: 'c1',
    name: 'Pan',
    quantity: 2,
  })
  expect(repository.setPurchased).toHaveBeenCalledWith('item-nuevo', true)
})

it('un borrado sin conexión llega al servidor al reanudar', async () => {
  onlineManager.setOnline(false)

  const client = newClient()
  startPaused(client, itemMutationKeys.remove, {
    communityId: 'c1',
    item: {
      id: 'item-1',
      name: 'Leche',
      quantity: 1,
      isPurchased: false,
      imagePath: null,
      createdAt: '2026-08-04T10:00:00.000Z',
    },
  })
  await settle()

  const stored = dehydrate(client, {
    shouldDehydrateQuery: () => false,
    shouldDehydrateMutation: shouldPersistMutation,
  })

  const restored = newClient()
  hydrate(restored, JSON.parse(JSON.stringify(stored)))

  onlineManager.setOnline(true)
  repository.remove.mockResolvedValue(undefined)

  await restored.resumePausedMutations()

  expect(repository.remove).toHaveBeenCalledWith('item-1')
})

it('una mutación ya terminada no se guarda', async () => {
  const client = newClient()
  repository.setPurchased.mockResolvedValue(undefined)

  startPaused(client, itemMutationKeys.togglePurchased, {
    communityId: 'c1',
    item: {
      id: 'item-1',
      name: 'Leche',
      quantity: 1,
      isPurchased: false,
      imagePath: null,
      createdAt: '2026-08-04T10:00:00.000Z',
    },
  })
  await settle()

  const stored = dehydrate(client, {
    shouldDehydrateQuery: () => false,
    shouldDehydrateMutation: shouldPersistMutation,
  })

  expect(repository.setPurchased).toHaveBeenCalledWith('item-1', true)
  expect(stored.mutations).toHaveLength(0)
})
