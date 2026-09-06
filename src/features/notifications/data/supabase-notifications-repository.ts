import { serverError } from '@/shared/lib/errors'
import { assertOnline } from '@/shared/lib/network'
import { addBreadcrumb, captureError } from '@/shared/lib/observability'
import { supabase } from '@/shared/lib/supabase'

import type { CommunityNotification, NotificationsRepository } from '../domain/notifications-repository'
import { parsePushToken } from '../domain/push-token'

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send'
const CHUNK_SIZE = 100

export class SupabaseNotificationsRepository implements NotificationsRepository {
  async registerToken(communityId: string, token: string, deviceName?: string): Promise<void> {
    const validToken = parsePushToken(token)
    if (!validToken) {
      return
    }

    assertOnline()

    const { error } = await supabase.rpc('register_push_token', {
      p_community_id: communityId,
      p_expo_push_token: validToken,
      p_device_name: deviceName ?? undefined,
    })

    if (error) {
      throw serverError('register_push_token', error)
    }

    addBreadcrumb({
      category: 'notifications',
      message: 'Push token registrado para la comunidad',
      data: { communityId, deviceName },
    })
  }

  async unregisterToken(token: string): Promise<void> {
    const validToken = parsePushToken(token)
    if (!validToken) {
      return
    }

    try {
      assertOnline()
      await supabase.rpc('unregister_push_token', {
        p_expo_push_token: validToken,
      })
    } catch {
      // Best-effort al cerrar sesión o desmontar
    }
  }

  async getCommunityTokens(communityId: string): Promise<string[]> {
    assertOnline()

    const { data, error } = await supabase.rpc('get_community_push_tokens', {
      p_community_id: communityId,
    })

    if (error) {
      throw serverError('get_community_push_tokens', error)
    }

    return (data ?? [])
      .map((row: { expo_push_token: string }) => parsePushToken(row.expo_push_token))
      .filter((t: string | null): t is string => Boolean(t))
  }

  async sendPushNotifications(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const validTokens = tokens.map(parsePushToken).filter((t): t is string => Boolean(t))
    if (validTokens.length === 0) {
      return
    }

    const messages = validTokens.map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data,
    }))

    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE)
      try {
        const response = await fetch(EXPO_PUSH_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(chunk),
        })

        if (!response.ok) {
          const text = await response.text()
          captureError(new Error(`Fallo en Expo Push API HTTP ${response.status}: ${text}`), {
            chunkSize: chunk.length,
          })
        }
      } catch (err) {
        captureError(err, { operation: 'sendPushNotifications', chunkSize: chunk.length })
      }
    }
  }

  async notifyCommunity(notification: CommunityNotification): Promise<void> {
    try {
      const tokens = await this.getCommunityTokens(notification.communityId)
      if (tokens.length === 0) {
        return
      }

      await this.sendPushNotifications(
        tokens,
        notification.title,
        notification.body,
        notification.data,
      )
    } catch (err) {
      captureError(err, { operation: 'notifyCommunity', communityId: notification.communityId })
    }
  }
}

export const supabaseNotificationsRepository = new SupabaseNotificationsRepository()
