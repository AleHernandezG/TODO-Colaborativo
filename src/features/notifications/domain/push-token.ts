const EXPO_PUSH_TOKEN_REGEX = /^Expo(nent)?PushToken\[[A-Za-z0-9_\-.~+]+\]$/

/**
 * Comprueba si una cadena cumple el formato oficial de token de Expo Push.
 */
export function isValidPushToken(token: unknown): token is string {
  if (typeof token !== 'string') {
    return false
  }
  const trimmed = token.trim()
  return trimmed.length >= 10 && trimmed.length <= 200 && EXPO_PUSH_TOKEN_REGEX.test(trimmed)
}

/**
 * Normaliza y valida un token de Expo Push devolviendo la cadena limpia o null.
 */
export function parsePushToken(raw: unknown): string | null {
  if (!isValidPushToken(raw)) {
    return null
  }
  return raw.trim()
}
