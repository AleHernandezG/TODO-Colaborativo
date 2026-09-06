export type CommunityNotification = {
  communityId: string
  title: string
  body: string
  data?: Record<string, unknown>
}

export interface NotificationsRepository {
  registerToken(communityId: string, token: string, deviceName?: string): Promise<void>
  unregisterToken(token: string): Promise<void>
  getCommunityTokens(communityId: string): Promise<string[]>
  sendPushNotifications(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void>
  notifyCommunity(notification: CommunityNotification): Promise<void>
}
