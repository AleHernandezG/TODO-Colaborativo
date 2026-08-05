import NetInfo from '@react-native-community/netinfo'

import { OfflineError } from '../../../../shared/lib/network'
import { supabase } from '../../../../shared/lib/supabase'
import { imageUrlTtlSeconds } from '../../domain/item-image'
import { supabaseItemRepository } from '../supabase-item-repository'

jest.mock('../../../../shared/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: { from: jest.fn() },
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}))

const from = supabase.from as jest.Mock
const storageFrom = supabase.storage.from as jest.Mock
const channel = supabase.channel as jest.Mock
const removeChannel = supabase.removeChannel as jest.Mock
const netInfoFetch = NetInfo.fetch as jest.Mock

function mockList(data: unknown, error: unknown = null) {
  from.mockReturnValue({
    select: () => ({ eq: () => ({ order: () => Promise.resolve({ data, error }) }) }),
  })
}

function mockInsert(data: unknown, error: unknown = null) {
  const insert = jest.fn(() => ({
    select: () => ({ single: () => Promise.resolve({ data, error }) }),
  }))
  from.mockReturnValue({ insert })
  return insert
}

function mockDuplicateInsert(existing: unknown) {
  const insert = jest.fn(() => ({
    select: () => ({
      single: () =>
        Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key value' } }),
    }),
  }))
  const select = jest.fn(() => ({
    eq: () => ({ single: () => Promise.resolve({ data: existing, error: null }) }),
  }))
  from.mockReturnValue({ insert, select })
  return { insert, select }
}

function mockUpdate(error: unknown = null) {
  const eq = jest.fn(() => Promise.resolve({ error }))
  const update = jest.fn(() => ({ eq }))
  from.mockReturnValue({ update })
  return { update, eq }
}

function mockDelete(error: unknown = null) {
  const eq = jest.fn(() => Promise.resolve({ error }))
  const del = jest.fn(() => ({ eq }))
  from.mockReturnValue({ delete: del })
  return { delete: del, eq }
}

function mockStorage(overrides: Record<string, jest.Mock> = {}) {
  const bucket = {
    upload: jest.fn(() => Promise.resolve({ error: null })),
    remove: jest.fn(() => Promise.resolve({ error: null })),
    createSignedUrl: jest.fn(() =>
      Promise.resolve({ data: { signedUrl: 'https://cdn/firmada' }, error: null }),
    ),
    ...overrides,
  }
  storageFrom.mockReturnValue(bucket)
  return bucket
}

beforeEach(() => {
  jest.clearAllMocks()
  netInfoFetch.mockResolvedValue({ isConnected: true })
})

describe('sin conexión', () => {
  beforeEach(() => {
    netInfoFetch.mockResolvedValue({ isConnected: false })
  })

  it('no lee, no añade, no edita, no marca ni borra', async () => {
    await expect(supabaseItemRepository.list('c1')).rejects.toBeInstanceOf(OfflineError)
    await expect(
      supabaseItemRepository.add({ id: 'i1', communityId: 'c1', name: 'Leche', quantity: 1 }),
    ).rejects.toBeInstanceOf(OfflineError)
    await expect(
      supabaseItemRepository.edit('i1', { name: 'Leche', quantity: 1 }),
    ).rejects.toBeInstanceOf(OfflineError)
    await expect(supabaseItemRepository.setPurchased('i1', true)).rejects.toBeInstanceOf(
      OfflineError,
    )
    await expect(supabaseItemRepository.remove('i1')).rejects.toBeInstanceOf(OfflineError)
    expect(from).not.toHaveBeenCalled()
  })

  it('tampoco sube, borra ni firma fotos', async () => {
    await expect(
      supabaseItemRepository.uploadImage({ communityId: 'c1', itemId: 'i1', uri: 'file:///f.jpg' }),
    ).rejects.toBeInstanceOf(OfflineError)
    await expect(supabaseItemRepository.removeImage('c1/i1.jpg')).rejects.toBeInstanceOf(
      OfflineError,
    )
    await expect(supabaseItemRepository.signImageUrl('c1/i1.jpg')).rejects.toBeInstanceOf(
      OfflineError,
    )
    expect(storageFrom).not.toHaveBeenCalled()
  })
})

describe('list', () => {
  it('mapea las filas a artículos del dominio', async () => {
    mockList([
      {
        id: 'i1',
        name: 'Leche',
        quantity: 2,
        is_purchased: false,
        image_path: 'c1/i1.jpg',
        created_at: '2026-07-20T10:00:00.000Z',
      },
    ])

    await expect(supabaseItemRepository.list('c1')).resolves.toEqual([
      {
        id: 'i1',
        name: 'Leche',
        quantity: 2,
        isPurchased: false,
        imagePath: 'c1/i1.jpg',
        createdAt: '2026-07-20T10:00:00.000Z',
      },
    ])
  })

  it('devuelve lista vacía cuando no hay filas', async () => {
    mockList(null)

    await expect(supabaseItemRepository.list('c1')).resolves.toEqual([])
  })

  it('falla con un mensaje que dice qué pasó', async () => {
    mockList(null, { message: 'permiso denegado' })

    await expect(supabaseItemRepository.list('c1')).rejects.toThrow('permiso denegado')
  })
})

describe('add', () => {
  it('inserta nombre y cantidad y devuelve el artículo mapeado', async () => {
    const insert = mockInsert({
      id: 'i1',
      name: 'Huevos',
      quantity: 12,
      is_purchased: false,
      image_path: null,
      created_at: '2026-07-20T10:05:00.000Z',
    })

    await expect(
      supabaseItemRepository.add({ id: 'i1', communityId: 'c1', name: 'Huevos', quantity: 12 }),
    ).resolves.toEqual({
      id: 'i1',
      name: 'Huevos',
      quantity: 12,
      isPurchased: false,
      imagePath: null,
      createdAt: '2026-07-20T10:05:00.000Z',
    })
    expect(insert).toHaveBeenCalledWith({
      id: 'i1',
      community_id: 'c1',
      name: 'Huevos',
      quantity: 12,
    })
  })

  it('falla con un mensaje que dice qué pasó', async () => {
    mockInsert(null, { message: 'fila viola la política' })

    await expect(
      supabaseItemRepository.add({ id: 'i1', communityId: 'c1', name: 'Pan', quantity: 1 }),
    ).rejects.toThrow('fila viola la política')
  })

  it('un alta repetida con el mismo id devuelve el artículo que ya estaba', async () => {
    mockDuplicateInsert({
      id: 'i1',
      name: 'Pan',
      quantity: 2,
      is_purchased: true,
      image_path: null,
      created_at: '2026-08-05T09:00:00.000Z',
    })

    await expect(
      supabaseItemRepository.add({ id: 'i1', communityId: 'c1', name: 'Pan', quantity: 2 }),
    ).resolves.toEqual({
      id: 'i1',
      name: 'Pan',
      quantity: 2,
      isPurchased: true,
      imagePath: null,
      createdAt: '2026-08-05T09:00:00.000Z',
    })
  })

  it('si el alta repetida ya no está en la lista, falla en vez de inventarse el artículo', async () => {
    mockDuplicateInsert(null)

    await expect(
      supabaseItemRepository.add({ id: 'i1', communityId: 'c1', name: 'Pan', quantity: 2 }),
    ).rejects.toThrow('ya se había añadido')
  })
})

describe('edit', () => {
  it('actualiza nombre y cantidad, y deja updated_at al trigger', async () => {
    const { update, eq } = mockUpdate()

    await expect(
      supabaseItemRepository.edit('i1', { name: 'Pan de molde', quantity: 3 }),
    ).resolves.toBeUndefined()
    expect(update).toHaveBeenCalledWith({ name: 'Pan de molde', quantity: 3 })
    expect(eq).toHaveBeenCalledWith('id', 'i1')
  })

  it('escribe image_path cuando la foto cambia', async () => {
    const { update } = mockUpdate()

    await supabaseItemRepository.edit('i1', {
      name: 'Pan',
      quantity: 1,
      imagePath: 'c1/i1.jpg',
    })

    expect(update).toHaveBeenCalledWith({ name: 'Pan', quantity: 1, image_path: 'c1/i1.jpg' })
  })

  it('escribe image_path a null cuando se quita la foto', async () => {
    const { update } = mockUpdate()

    await supabaseItemRepository.edit('i1', { name: 'Pan', quantity: 1, imagePath: null })

    expect(update).toHaveBeenCalledWith({ name: 'Pan', quantity: 1, image_path: null })
  })

  it('falla con un mensaje que dice qué pasó', async () => {
    mockUpdate({ message: 'no encontrado' })

    await expect(supabaseItemRepository.edit('i1', { name: 'Pan', quantity: 1 })).rejects.toThrow(
      'no encontrado',
    )
  })
})

describe('fotos', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
    global.fetch = fetchMock as unknown as typeof fetch
  })

  it('sube la foto a la carpeta de su comunidad y devuelve la ruta', async () => {
    const bucket = mockStorage()

    const path = await supabaseItemRepository.uploadImage({
      communityId: 'c1',
      itemId: 'i1',
      uri: 'file:///tmp/foto.jpg',
    })

    expect(path).toMatch(/^c1\/i1-\d+\.jpg$/)
    expect(storageFrom).toHaveBeenCalledWith('item-images')
    expect(bucket.upload).toHaveBeenCalledWith(path, expect.any(ArrayBuffer), {
      contentType: 'image/jpeg',
      upsert: true,
    })
  })

  it('dos subidas del mismo artículo dan rutas distintas', async () => {
    mockStorage()
    const now = jest.spyOn(Date, 'now')
    now.mockReturnValueOnce(1000).mockReturnValueOnce(2000)

    const upload = () =>
      supabaseItemRepository.uploadImage({
        communityId: 'c1',
        itemId: 'i1',
        uri: 'file:///tmp/foto.jpg',
      })

    const first = await upload()
    const second = await upload()
    now.mockRestore()

    expect(first).not.toBe(second)
  })

  it('falla con un mensaje que dice qué pasó al subir', async () => {
    mockStorage({ upload: jest.fn(() => Promise.resolve({ error: { message: 'demasiado grande' } })) })

    await expect(
      supabaseItemRepository.uploadImage({
        communityId: 'c1',
        itemId: 'i1',
        uri: 'file:///tmp/foto.jpg',
      }),
    ).rejects.toThrow('demasiado grande')
  })

  it('borra la foto por su ruta', async () => {
    const bucket = mockStorage()

    await expect(supabaseItemRepository.removeImage('c1/i1.jpg')).resolves.toBeUndefined()
    expect(bucket.remove).toHaveBeenCalledWith(['c1/i1.jpg'])
  })

  it('firma la ruta con la caducidad del dominio', async () => {
    const bucket = mockStorage()

    await expect(supabaseItemRepository.signImageUrl('c1/i1.jpg')).resolves.toBe(
      'https://cdn/firmada',
    )
    expect(bucket.createSignedUrl).toHaveBeenCalledWith('c1/i1.jpg', imageUrlTtlSeconds)
  })

  it('falla si la firma no devuelve URL', async () => {
    mockStorage({
      createSignedUrl: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })

    await expect(supabaseItemRepository.signImageUrl('c1/i1.jpg')).rejects.toThrow('sin respuesta')
  })
})

describe('setPurchased', () => {
  it('actualiza is_purchased del artículo', async () => {
    const { update, eq } = mockUpdate()

    await expect(supabaseItemRepository.setPurchased('i1', true)).resolves.toBeUndefined()
    expect(update).toHaveBeenCalledWith({ is_purchased: true })
    expect(eq).toHaveBeenCalledWith('id', 'i1')
  })

  it('falla con un mensaje que dice qué pasó', async () => {
    mockUpdate({ message: 'no encontrado' })

    await expect(supabaseItemRepository.setPurchased('i1', true)).rejects.toThrow('no encontrado')
  })
})

describe('remove', () => {
  it('borra el artículo por id', async () => {
    const { eq } = mockDelete()

    await expect(supabaseItemRepository.remove('i1')).resolves.toBeUndefined()
    expect(eq).toHaveBeenCalledWith('id', 'i1')
  })

  it('falla con un mensaje que dice qué pasó', async () => {
    mockDelete({ message: 'no encontrado' })

    await expect(supabaseItemRepository.remove('i1')).rejects.toThrow('no encontrado')
  })
})

describe('subscribe', () => {
  type FakeChannel = {
    on: jest.Mock
    subscribe: jest.Mock
  }

  function mockChannel() {
    const listeners: { config: Record<string, unknown>; handler: () => void }[] = []
    let statusCallback: ((status: string) => void) | undefined
    const built: FakeChannel = {
      on: jest.fn((_event: string, config: Record<string, unknown>, handler: () => void) => {
        listeners.push({ config, handler })
        return built
      }),
      subscribe: jest.fn((callback: (status: string) => void) => {
        statusCallback = callback
        return built
      }),
    }
    channel.mockReturnValue(built)
    return { built, listeners, emitStatus: (status: string) => statusCallback?.(status) }
  }

  it('escucha solo los cambios de su comunidad', () => {
    const { listeners } = mockChannel()

    supabaseItemRepository.subscribe('c1', { onChange: jest.fn(), onStatus: jest.fn() })

    expect(channel).toHaveBeenCalledWith('items:c1')
    expect(listeners).toHaveLength(1)
    expect(listeners[0].config).toEqual({
      event: '*',
      schema: 'public',
      table: 'items',
      filter: 'community_id=eq.c1',
    })
  })

  it('avisa de cada cambio sin mirar el contenido del evento', () => {
    const { listeners } = mockChannel()
    const onChange = jest.fn()

    supabaseItemRepository.subscribe('c1', { onChange, onStatus: jest.fn() })
    listeners[0].handler()
    listeners[0].handler()

    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('traduce el estado del canal a conectado o desconectado', () => {
    const { emitStatus } = mockChannel()
    const onStatus = jest.fn()

    supabaseItemRepository.subscribe('c1', { onChange: jest.fn(), onStatus })

    emitStatus('SUBSCRIBED')
    expect(onStatus).toHaveBeenLastCalledWith('connected')

    for (const status of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) {
      emitStatus(status)
      expect(onStatus).toHaveBeenLastCalledWith('disconnected')
    }
  })

  it('la función que devuelve cierra el canal', () => {
    const { built } = mockChannel()

    const unsubscribe = supabaseItemRepository.subscribe('c1', {
      onChange: jest.fn(),
      onStatus: jest.fn(),
    })

    expect(removeChannel).not.toHaveBeenCalled()
    unsubscribe()
    expect(removeChannel).toHaveBeenCalledWith(built)
  })

  it('se suscribe aunque NetInfo diga que no hay red', () => {
    netInfoFetch.mockResolvedValue({ isConnected: false })
    mockChannel()

    supabaseItemRepository.subscribe('c1', { onChange: jest.fn(), onStatus: jest.fn() })

    expect(channel).toHaveBeenCalledWith('items:c1')
  })
})
