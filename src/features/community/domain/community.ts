export type Community = {
  id: string
  name: string
  joinCode: string
}

export type Membership = {
  community: Community
  username: string
}
