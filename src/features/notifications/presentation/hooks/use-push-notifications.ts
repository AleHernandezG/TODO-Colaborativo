import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
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

export function usePushNotifications(
  communityIds: readonly string[],
  onOpenCommunity?: (communityId: string) => boolean,
) {
  const router = useRouter()
  const [currentToken, setCurrentToken] = useState<string | null>(null)
  const communityIdsKey = communityIds.join(',')
  const openCommunity = useRef(onOpenCommunity)

  useEffect(() => {
    openCommunity.current = onOpenCommunity
  }, [onOpenCommunity])

  useEffect(() => {
    let isMounted = true
    const ids = communityIdsKey === '' ? [] : communityIdsKey.split(',')

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

        const registrations = await Promise.allSettled(
          ids.map((communityId) =>
            supabaseNotificationsRepository.registerToken(
              communityId,
              token,
              Device.modelName ?? undefined,
            ),
          ),
        )
        registrations.forEach((registration, index) => {
          if (registration.status === 'rejected') {
            captureError(registration.reason, {
              operation: 'registerPushToken',
              communityId: ids[index],
            })
          }
        })
      } catch (err) {
        captureError(err, { operation: 'registerPushToken' })
      }
    }

    setupChannelAndRegister()

    // 3. Listener para navegación al pulsar la notificación en segundo plano
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data
      if (typeof data?.url !== 'string') {
        return
      }
      if (typeof data.communityId === 'string' && openCommunity.current) {
        const opened = openCommunity.current(data.communityId)
        if (!opened) {
          return
        }
      }
      router.push(data.url as any)
    })

    return () => {
      isMounted = false
      subscription.remove()
    }
  }, [communityIdsKey, router])

  return {
    currentToken,
  }
}
