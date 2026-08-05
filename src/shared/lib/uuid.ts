import { uuid } from 'expo-modules-core'

export function randomUuid(): string {
  return uuid.v4()
}
