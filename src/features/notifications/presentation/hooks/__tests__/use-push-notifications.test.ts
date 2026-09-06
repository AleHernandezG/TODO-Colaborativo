import { renderHook, waitFor } from '@testing-library/react-native'
import * as Notifications from 'expo-notifications'

import { supabaseNotificationsRepository } from '../../../data/supabase-notifications-repository'
import { usePushNotifications } from '../use-push-notifications'

jest.mock('../../../data/supabase-notifications-repository', () => ({
  supabaseNotificationsRepository: {
    registerToken: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('obtiene el push token y lo registra en la comunidad si los permisos están concedidos', async () => {
    const { result } = await renderHook(() => usePushNotifications('comm-123'))

    await waitFor(() => {
      expect(Notifications.getPermissionsAsync).toHaveBeenCalled()
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalled()
      expect(supabaseNotificationsRepository.registerToken).toHaveBeenCalledWith(
        'comm-123',
        'ExponentPushToken[mock-token-123]',
        'Pixel 8',
      )
    })

    expect(result.current.currentToken).toBe('ExponentPushToken[mock-token-123]')
  })

  it('solicita permisos si el estado previo no es granted', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' })
    await renderHook(() => usePushNotifications('comm-456'))

    await waitFor(() => {
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled()
      expect(supabaseNotificationsRepository.registerToken).toHaveBeenCalledWith(
        'comm-456',
        'ExponentPushToken[mock-token-123]',
        'Pixel 8',
      )
    })
  })
})
