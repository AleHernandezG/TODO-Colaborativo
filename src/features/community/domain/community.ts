export type Community = {
  id: string
  name: string
  joinCode: string
}

export type JoinCodeInfo = {
  code: string
  expiresAt: string
}

export type Membership = {
  community: Community
  username: string
}
