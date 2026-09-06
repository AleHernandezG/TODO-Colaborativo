import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { captureError } from '@/shared/lib/observability'

import { supabaseNotificationsRepository } from '../../data/supabase-notifications-repository'

// Configuración de visualización de notificaciones en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export function usePushNotifications(communityId?: string | null) {
  const router = useRouter()
  const [currentToken, setCurrentToken] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function setupChannelAndRegister() {
      // 1. Canal obligatorio para Android 8.0+
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#208AEF',
          })
        } catch (err) {
          captureError(err, { operation: 'setNotificationChannelAsync' })
        }
      }

      // 2. Solo registrar en dispositivos reales (o si expo-device lo permite)
      if (!Device.isDevice) {
        return
      }

      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync()
        let finalStatus = existingStatus

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync()
          finalStatus = status
        }

        if (finalStatus !== 'granted') {
          return
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId
        const tokenResult = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        )

        const token = tokenResult.data
        if (!isMounted || !token) {
          return
        }

        setCurrentToken(token)

        if (communityId) {
          await supabaseNotificationsRepository.registerToken(
            communityId,
            token,
            Device.modelName ?? undefined,
          )
        }
      } catch (err) {
        captureError(err, { operation: 'registerPushToken', communityId })
      }
    }

    setupChannelAndRegister()

    // 3. Listener para navegación al pulsar la notificación en segundo plano
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data
      if (typeof data?.url === 'string') {
        router.push(data.url as any)
      }
    })

    return () => {
      isMounted = false
      subscription.remove()
    }
  }, [communityId, router])

  return {
    currentToken,
  }
}
