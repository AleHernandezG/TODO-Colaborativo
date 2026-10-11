import { renderHook, waitFor } from '@testing-library/react-native'
import * as Notifications from 'expo-notifications'

import { supabaseNotificationsRepository } from '../../../data/supabase-notifications-repository'
import { usePushNotifications } from '../use-push-notifications'

const mockPush = jest.fn()
const mockRouter = { push: mockPush }

jest.mock('../../../data/supabase-notifications-repository', () => ({
  supabaseNotificationsRepository: {
    registerToken: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}))

const registerToken = supabaseNotificationsRepository.registerToken as jest.Mock
const addResponseListener = Notifications.addNotificationResponseReceivedListener as jest.Mock

function tapNotification(data: Record<string, unknown>) {
  const listener = addResponseListener.mock.calls.at(-1)?.[0]
  listener({ notification: { request: { content: { data } } } })
}

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    registerToken.mockResolvedValue(undefined)
    addResponseListener.mockReturnValue({ remove: jest.fn() })
  })

  it('obtiene el push token y lo registra en la comunidad si los permisos están concedidos', async () => {
    const { result } = await renderHook(() => usePushNotifications(['comm-123']))

    await waitFor(() => {
      expect(Notifications.getPermissionsAsync).toHaveBeenCalled()
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalled()
      expect(registerToken).toHaveBeenCalledWith(
        'comm-123',
        'ExponentPushToken[mock-token-123]',
        'Pixel 8',
      )
    })

    expect(result.current.currentToken).toBe('ExponentPushToken[mock-token-123]')
  })

  it('solicita permisos si el estado previo no es granted', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'undetermined',
    })
    await renderHook(() => usePushNotifications(['comm-456']))

    await waitFor(() => {
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled()
      expect(registerToken).toHaveBeenCalledWith(
        'comm-456',
        'ExponentPushToken[mock-token-123]',
        'Pixel 8',
      )
    })
  })

  it('registra el token en todas mis listas, no solo en la abierta', async () => {
    await renderHook(() => usePushNotifications(['comm-1', 'comm-2', 'comm-3']))

    await waitFor(() => expect(registerToken).toHaveBeenCalledTimes(3))
    expect(registerToken.mock.calls.map((call) => call[0])).toEqual(['comm-1', 'comm-2', 'comm-3'])
  })

  it('que falle el registro en una lista no impide el de las demás', async () => {
    registerToken.mockRejectedValueOnce(new Error('rls'))
    await renderHook(() => usePushNotifications(['comm-1', 'comm-2']))

    await waitFor(() => expect(registerToken).toHaveBeenCalledTimes(2))
  })

  it('no vuelve a registrar si el array es otro pero las listas son las mismas', async () => {
    const { rerender } = await renderHook(
      ({ ids }: { ids: string[] }) => usePushNotifications(ids),
      { initialProps: { ids: ['comm-1', 'comm-2'] } },
    )
    await waitFor(() => expect(registerToken).toHaveBeenCalledTimes(2))

    await rerender({ ids: ['comm-1', 'comm-2'] })

    expect(registerToken).toHaveBeenCalledTimes(2)
  })

  it('al tocar una notificación de otra lista, la abre antes de navegar', async () => {
    const order: string[] = []
    const onOpenCommunity = jest.fn((id: string) => {
      order.push(`open:${id}`)
      return true
    })
    mockPush.mockImplementation((url: string) => order.push(`push:${url}`))
    await renderHook(() => usePushNotifications(['comm-1'], onOpenCommunity))

    tapNotification({ url: '/expenses', communityId: 'comm-2' })

    expect(order).toEqual(['open:comm-2', 'push:/expenses'])
  })

  it('no navega si la notificación es de una lista en la que ya no estoy', async () => {
    const onOpenCommunity = jest.fn(() => false)
    await renderHook(() => usePushNotifications(['comm-1'], onOpenCommunity))

    tapNotification({ url: '/expenses', communityId: 'comm-9' })

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('una notificación de una versión anterior, sin lista, navega como siempre', async () => {
    const onOpenCommunity = jest.fn(() => false)
    await renderHook(() => usePushNotifications(['comm-1'], onOpenCommunity))

    tapNotification({ url: '/list' })

    expect(onOpenCommunity).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/list')
  })
})
