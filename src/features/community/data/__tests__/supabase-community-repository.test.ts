import NetInfo from '@react-native-community/netinfo'

import { OfflineError } from '@/shared/lib/network'
import { supabase } from '@/shared/lib/supabase'

import { supabaseCommunityRepository } from '../supabase-community-repository'

jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
    },
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}))

const rpc = supabase.rpc as jest.Mock
const from = supabase.from as jest.Mock
const channel = supabase.channel as jest.Mock
const removeChannel = supabase.removeChannel as jest.Mock
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
      supabaseCommunityRepository.create({ name: 'Casa', username: 'Ana', pin: '1234' }),
    ).rejects.toBeInstanceOf(OfflineError)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('no llega a llamar a join_community', async () => {
    await expect(
      supabaseCommunityRepository.join({ joinCode: 'PAN-42XK', username: 'Ana', pin: '1234' }),
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
      supabaseCommunityRepository.create({ name: 'Casa', username: 'Ana', pin: '1234' }),
    ).resolves.toEqual({
      community: { id: 'c1', name: 'Casa', joinCode: 'PAN-42XK' },
      username: 'Ana',
    })
    expect(rpc).toHaveBeenCalledWith('create_community', {
      p_name: 'Casa',
      p_username: 'Ana',
      p_pin: '1234',
    })
  })

  it('falla con un mensaje que dice qué pasó', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'sin conexión' } })

    await expect(
      supabaseCommunityRepository.create({ name: 'Casa', username: 'Ana', pin: '1234' }),
    ).rejects.toThrow('sin conexión')
  })
})

describe('join', () => {
  it('lee la comunidad cuando el estado es ok', async () => {
    rpc.mockResolvedValue({ data: [{ status: 'ok', community_id: 'c1' }], error: null })
    mockCommunityRow({ id: 'c1', name: 'Casa', join_code: 'PAN-42XK' })

    await expect(
      supabaseCommunityRepository.join({ joinCode: 'PAN-42XK', username: 'Ana', pin: '1234' }),
    ).resolves.toEqual({
      status: 'ok',
      membership: { community: { id: 'c1', name: 'Casa', joinCode: 'PAN-42XK' }, username: 'Ana' },
    })
    expect(rpc).toHaveBeenCalledWith('join_community', {
      p_join_code: 'PAN-42XK',
      p_username: 'Ana',
      p_pin: '1234',
    })
  })

  it('devuelve el estado de código inválido sin leer nada más', async () => {
    rpc.mockResolvedValue({
      data: [{ status: 'invalid_join_code', community_id: null }],
      error: null,
    })

    await expect(
      supabaseCommunityRepository.join({ joinCode: 'ZZZ-9999', username: 'Ana', pin: '1234' }),
    ).resolves.toEqual({ status: 'invalid_join_code' })
    expect(from).not.toHaveBeenCalled()
  })

  it('devuelve el estado de PIN erróneo', async () => {
    rpc.mockResolvedValue({
      data: [{ status: 'invalid_pin', community_id: null }],
      error: null,
    })

    await expect(
      supabaseCommunityRepository.join({ joinCode: 'PAN-42XK', username: 'Ana', pin: '0000' }),
    ).resolves.toEqual({ status: 'wrong_pin' })
    expect(from).not.toHaveBeenCalled()
  })

  it('devuelve el estado del rate limit', async () => {
    rpc.mockResolvedValue({
      data: [{ status: 'too_many_attempts', community_id: null }],
      error: null,
    })

    await expect(
      supabaseCommunityRepository.join({ joinCode: 'ZZZ-9999', username: 'Ana', pin: '1234' }),
    ).resolves.toEqual({ status: 'too_many_attempts' })
  })

  it('no se traga un estado que no conoce', async () => {
    rpc.mockResolvedValue({ data: [{ status: 'community_full', community_id: null }], error: null })

    await expect(
      supabaseCommunityRepository.join({ joinCode: 'PAN-42XK', username: 'Ana', pin: '1234' }),
    ).rejects.toThrow('community_full')
  })

  it('falla si entró pero no puede leer la comunidad', async () => {
    rpc.mockResolvedValue({ data: [{ status: 'ok', community_id: 'c1' }], error: null })
    mockCommunityRow(null, { message: 'permiso denegado' })

    await expect(
      supabaseCommunityRepository.join({ joinCode: 'PAN-42XK', username: 'Ana', pin: '1234' }),
    ).rejects.toThrow('permiso denegado')
  })

  it('devuelve el estado de código caducado sin leer nada más', async () => {
    rpc.mockResolvedValue({
      data: [{ status: 'expired_join_code', community_id: null }],
      error: null,
    })

    await expect(
      supabaseCommunityRepository.join({ joinCode: 'PAN-42XK', username: 'Ana', pin: '1234' }),
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

describe('listMembers', () => {
  it('filtra miembros activos por defecto y mapea campos', async () => {
    const isMock = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'm1',
          username: 'Ana',
          auth_user_id: 'u1',
          is_admin: true,
          removed_at: null,
        },
        {
          id: 'm2',
          username: 'Carlos',
          auth_user_id: null,
          is_admin: false,
          removed_at: null,
        },
      ],
      error: null,
    })

    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            is: isMock,
          }),
        }),
      }),
    })

    const members = await supabaseCommunityRepository.listMembers('c1')

    expect(isMock).toHaveBeenCalledWith('removed_at', null)
    expect(members).toEqual([
      {
        id: 'm1',
        username: 'Ana',
        isSelf: true,
        isAdmin: true,
        isGuest: false,
        removedAt: null,
      },
      {
        id: 'm2',
        username: 'Carlos',
        isSelf: false,
        isAdmin: false,
        isGuest: true,
        removedAt: null,
      },
    ])
  })

  it('permite incluir archivados cuando se especifica', async () => {
    const orderMock = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'm1',
          username: 'Ana',
          auth_user_id: 'u1',
          is_admin: true,
          removed_at: null,
        },
        {
          id: 'm2',
          username: 'Bruno',
          auth_user_id: 'u2',
          is_admin: false,
          removed_at: '2026-09-04T10:00:00Z',
        },
      ],
      error: null,
    })

    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: orderMock,
        }),
      }),
    })

    const members = await supabaseCommunityRepository.listMembers('c1', { includeArchived: true })

    expect(members).toHaveLength(2)
    expect(members[1]?.removedAt).toBe('2026-09-04T10:00:00Z')
  })
})

describe('removeMember', () => {
  it('llama a la RPC remove_member y devuelve el estado', async () => {
    rpc.mockResolvedValue({
      data: [{ status: 'deleted' }],
      error: null,
    })

    const result = await supabaseCommunityRepository.removeMember('c1', 'm2')

    expect(rpc).toHaveBeenCalledWith('remove_member', {
      p_community_id: 'c1',
      p_member_id: 'm2',
    })
    expect(result).toEqual({ status: 'deleted' })
  })

  it('lanza error si la RPC falla', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'cannot_remove_self' },
    })

    await expect(supabaseCommunityRepository.removeMember('c1', 'm1')).rejects.toThrow(
      'cannot_remove_self',
    )
  })
})

describe('setMemberAdmin', () => {
  it('llama a la RPC set_member_admin con el valor booleano', async () => {
    rpc.mockResolvedValue({ error: null })

    await supabaseCommunityRepository.setMemberAdmin('c1', 'm2', true)

    expect(rpc).toHaveBeenCalledWith('set_member_admin', {
      p_community_id: 'c1',
      p_member_id: 'm2',
      p_is_admin: true,
    })
  })
})

describe('addGuestMember', () => {
  it('llama a la RPC add_guest_member y devuelve el miembro invitado', async () => {
    rpc.mockResolvedValue({
      data: [{ id: 'g1', username: 'Marcos' }],
      error: null,
    })

    const result = await supabaseCommunityRepository.addGuestMember('c1', 'Marcos')

    expect(rpc).toHaveBeenCalledWith('add_guest_member', {
      p_community_id: 'c1',
      p_username: 'Marcos',
    })
    expect(result).toEqual({
      id: 'g1',
      username: 'Marcos',
      isSelf: false,
      isAdmin: false,
      isGuest: true,
      removedAt: null,
    })
  })
})

describe('subscribeMembers', () => {
  it('crea un canal con filtro por comunidad y devuelve función para desuscribirse', () => {
    const onMock = jest.fn().mockReturnThis()
    const subscribeMock = jest.fn().mockReturnThis()
    const channelMock = { on: onMock, subscribe: subscribeMock }
    channel.mockReturnValue(channelMock)

    const onChange = jest.fn()
    const unsubscribe = supabaseCommunityRepository.subscribeMembers('c1', onChange)

    expect(channel).toHaveBeenCalledWith('members:c1')
    expect(onMock).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'members',
        filter: 'community_id=eq.c1',
      },
      expect.any(Function),
    )

    unsubscribe()
    expect(removeChannel).toHaveBeenCalledWith(channelMock)
  })
})

