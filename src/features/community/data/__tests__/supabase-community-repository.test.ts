import NetInfo from '@react-native-community/netinfo'

import { OfflineError } from '../../../../shared/lib/network'
import { supabase } from '../../../../shared/lib/supabase'
import { supabaseCommunityRepository } from '../supabase-community-repository'

jest.mock('../../../../shared/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}))

const rpc = supabase.rpc as jest.Mock
const from = supabase.from as jest.Mock
const netInfoFetch = NetInfo.fetch as jest.Mock

function mockCommunityRow(row: unknown, error: unknown = null) {
  from.mockReturnValue({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: row, error }) }) }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  netInfoFetch.mockResolvedValue({ isConnected: true })
})

describe('sin conexión', () => {
  beforeEach(() => {
    netInfoFetch.mockResolvedValue({ isConnected: false })
  })

  it('no llega a llamar a create_community', async () => {
    await expect(
      supabaseCommunityRepository.create({ name: 'Casa', username: 'Ana' }),
    ).rejects.toBeInstanceOf(OfflineError)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('no llega a llamar a join_community', async () => {
    await expect(
      supabaseCommunityRepository.join({ joinCode: 'PAN-42XK', username: 'Ana' }),
    ).rejects.toBeInstanceOf(OfflineError)
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('create', () => {
  it('devuelve la comunidad con el código que generó la base de datos', async () => {
    rpc.mockResolvedValue({
      data: [{ community_id: 'c1', join_code: 'PAN-42XK' }],
      error: null,
    })

    await expect(
      supabaseCommunityRepository.create({ name: 'Casa', username: 'Ana' }),
    ).resolves.toEqual({
      community: { id: 'c1', name: 'Casa', joinCode: 'PAN-42XK' },
      username: 'Ana',
    })
  })

  it('falla con un mensaje que dice qué pasó', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'sin conexión' } })

    await expect(
      supabaseCommunityRepository.create({ name: 'Casa', username: 'Ana' }),
    ).rejects.toThrow('sin conexión')
  })
})

describe('join', () => {
  it('lee la comunidad cuando el estado es ok', async () => {
    rpc.mockResolvedValue({ data: [{ status: 'ok', community_id: 'c1' }], error: null })
    mockCommunityRow({ id: 'c1', name: 'Casa', join_code: 'PAN-42XK' })

    await expect(
      supabaseCommunityRepository.join({ joinCode: 'PAN-42XK', username: 'Ana' }),
    ).resolves.toEqual({
      status: 'ok',
      membership: { community: { id: 'c1', name: 'Casa', joinCode: 'PAN-42XK' }, username: 'Ana' },
    })
  })

  it('devuelve el estado de código inválido sin leer nada más', async () => {
    rpc.mockResolvedValue({
      data: [{ status: 'invalid_join_code', community_id: null }],
      error: null,
    })

    await expect(
      supabaseCommunityRepository.join({ joinCode: 'ZZZ-9999', username: 'Ana' }),
    ).resolves.toEqual({ status: 'invalid_join_code' })
    expect(from).not.toHaveBeenCalled()
  })

  it('devuelve el estado del rate limit', async () => {
    rpc.mockResolvedValue({
      data: [{ status: 'too_many_attempts', community_id: null }],
      error: null,
    })

    await expect(
      supabaseCommunityRepository.join({ joinCode: 'ZZZ-9999', username: 'Ana' }),
    ).resolves.toEqual({ status: 'too_many_attempts' })
  })

  it('no se traga un estado que no conoce', async () => {
    rpc.mockResolvedValue({ data: [{ status: 'community_full', community_id: null }], error: null })

    await expect(
      supabaseCommunityRepository.join({ joinCode: 'PAN-42XK', username: 'Ana' }),
    ).rejects.toThrow('community_full')
  })

  it('falla si entró pero no puede leer la comunidad', async () => {
    rpc.mockResolvedValue({ data: [{ status: 'ok', community_id: 'c1' }], error: null })
    mockCommunityRow(null, { message: 'permiso denegado' })

    await expect(
      supabaseCommunityRepository.join({ joinCode: 'PAN-42XK', username: 'Ana' }),
    ).rejects.toThrow('permiso denegado')
  })
})
