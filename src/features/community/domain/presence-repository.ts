export interface PresenceRepository {
  watch(
    input: { communityId: string; username: string },
    onChange: (usernames: string[]) => void,
  ): () => void
}
