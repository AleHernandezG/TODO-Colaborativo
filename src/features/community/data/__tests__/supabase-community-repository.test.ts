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

  it('no llega a leer el código de invitación', async () => {
    await expect(supabaseCommunityRepository.getJoinCode('c1')).rejects.toBeInstanceOf(OfflineError)
    expect(from).not.toHaveBeenCalled()
  })

  it('no llega a rotar el código', async () => {
    await expect(supabaseCommunityRepository.rotateJoinCode('c1')).rejects.toBeInstanceOf(
      OfflineError,
    )
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

  it('devuelve el estado de código caducado sin leer nada más', async () => {
    rpc.mockResolvedValue({
      data: [{ status: 'expired_join_code', community_id: null }],
      error: null,
    })

    await expect(
      supabaseCommunityRepository.join({ joinCode: 'PAN-42XK', username: 'Ana' }),
    ).resolves.toEqual({ status: 'expired_join_code' })
    expect(from).not.toHaveBeenCalled()
  })
})

describe('getJoinCode', () => {
  it('devuelve el código con su fecha de caducidad', async () => {
    mockCommunityRow({ join_code: 'PAN-42XK', join_code_expires_at: '2026-08-12T10:00:00Z' })

    await expect(supabaseCommunityRepository.getJoinCode('c1')).resolves.toEqual({
      code: 'PAN-42XK',
      expiresAt: '2026-08-12T10:00:00Z',
    })
  })

  it('falla con un mensaje que dice qué pasó', async () => {
    mockCommunityRow(null, { message: 'permiso denegado' })

    await expect(supabaseCommunityRepository.getJoinCode('c1')).rejects.toThrow('permiso denegado')
  })
})

describe('rotateJoinCode', () => {
  it('devuelve el código nuevo que generó la base de datos', async () => {
    rpc.mockResolvedValue({
      data: [{ join_code: 'TRE-88MW', expires_at: '2026-08-12T10:00:00Z' }],
      error: null,
    })

    await expect(supabaseCommunityRepository.rotateJoinCode('c1')).resolves.toEqual({
      code: 'TRE-88MW',
      expiresAt: '2026-08-12T10:00:00Z',
    })
    expect(rpc).toHaveBeenCalledWith('rotate_join_code', { p_community_id: 'c1' })
  })

  it('falla si no eres miembro de esa lista', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'not_a_member' } })

    await expect(supabaseCommunityRepository.rotateJoinCode('c1')).rejects.toThrow('not_a_member')
  })

  it('falla si la rpc no devuelve ningún código', async () => {
    rpc.mockResolvedValue({ data: [], error: null })

    await expect(supabaseCommunityRepository.rotateJoinCode('c1')).rejects.toThrow(
      'no devolvió ningún código',
    )
  })
})
