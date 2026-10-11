import { supabase } from '@/shared/lib/supabase'

import { SupabaseNotificationsRepository } from '../supabase-notifications-repository'

jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}))

describe('SupabaseNotificationsRepository', () => {
  let repository: SupabaseNotificationsRepository
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new SupabaseNotificationsRepository()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
      text: async () => 'ok',
    }) as jest.Mock
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('registerToken invoca la RPC con token válido', async () => {
    ;(supabase.rpc as jest.Mock).mockResolvedValueOnce({ error: null })

    await repository.registerToken('comm-1', 'ExponentPushToken[device-123]', 'Pixel 8')

    expect(supabase.rpc).toHaveBeenCalledWith('register_push_token', {
      p_community_id: 'comm-1',
      p_expo_push_token: 'ExponentPushToken[device-123]',
      p_device_name: 'Pixel 8',
    })
  })

  it('registerToken ignora tokens con formato inválido', async () => {
    await repository.registerToken('comm-1', 'not-a-token')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('unregisterToken invoca la RPC con token válido', async () => {
    ;(supabase.rpc as jest.Mock).mockResolvedValueOnce({ error: null })

    await repository.unregisterToken('ExponentPushToken[device-123]')

    expect(supabase.rpc).toHaveBeenCalledWith('unregister_push_token', {
      p_expo_push_token: 'ExponentPushToken[device-123]',
    })
  })

  it('getCommunityTokens devuelve lista limpia de tokens válidos', async () => {
    ;(supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: [
        { expo_push_token: 'ExponentPushToken[token-A]' },
        { expo_push_token: 'invalid' },
        { expo_push_token: 'ExpoPushToken[token-B]' },
      ],
      error: null,
    })

    const tokens = await repository.getCommunityTokens('comm-1')

    expect(tokens).toEqual([
      'ExponentPushToken[token-A]',
      'ExpoPushToken[token-B]',
    ])
  })

  it('sendPushNotifications envía payload a Expo Push API', async () => {
    const tokens = ['ExponentPushToken[token-1]', 'ExponentPushToken[token-2]']
    await repository.sendPushNotifications(tokens, 'Lista', 'Leche añadida', { itemId: '123' })

    expect(global.fetch).toHaveBeenCalledWith('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify([
        {
          to: 'ExponentPushToken[token-1]',
          sound: 'default',
          title: 'Lista',
          body: 'Leche añadida',
          data: { itemId: '123' },
        },
        {
          to: 'ExponentPushToken[token-2]',
          sound: 'default',
          title: 'Lista',
          body: 'Leche añadida',
          data: { itemId: '123' },
        },
      ]),
    })
  })

  it('notifyCommunity obtiene tokens y dispara el envío push', async () => {
    ;(supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: [{ expo_push_token: 'ExponentPushToken[token-peer]' }],
      error: null,
    })

    await repository.notifyCommunity({
      communityId: 'comm-1',
      title: 'Compra',
      body: 'Carlos añadió 1x Pan',
    })

    expect(global.fetch).toHaveBeenCalled()
  })

  it('notifyCommunity manda la lista de origen junto a los datos de la notificación', async () => {
    ;(supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: [{ expo_push_token: 'ExponentPushToken[token-peer]' }],
      error: null,
    })

    await repository.notifyCommunity({
      communityId: 'comm-1',
      title: 'Gastos',
      body: 'Carlos apuntó un gasto',
      data: { url: '/expenses' },
    })

    const [, request] = (global.fetch as jest.Mock).mock.calls.at(-1)
    expect(JSON.parse(request.body)[0].data).toEqual({ url: '/expenses', communityId: 'comm-1' })
  })
})
