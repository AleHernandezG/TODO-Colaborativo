export const supportedLanguages = ['es', 'en'] as const

export type SupportedLanguage = (typeof supportedLanguages)[number]

export const fallbackLanguage: SupportedLanguage = 'es'

export function resolveLanguage(
  languageCodes: readonly (string | null | undefined)[],
): SupportedLanguage {
  for (const code of languageCodes) {
    const language = code?.toLowerCase().split('-')[0]
    if (language && (supportedLanguages as readonly string[]).includes(language)) {
      return language as SupportedLanguage
    }
  }
  return fallbackLanguage
}
