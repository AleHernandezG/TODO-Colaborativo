import { getLocales } from 'expo-localization'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './en.json'
import es from './es.json'
import { fallbackLanguage, resolveLanguage } from './resolve-language'

const resources = {
  es: { translation: es },
  en: { translation: en },
}

i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguage(getLocales().map((locale) => locale.languageCode)),
  fallbackLng: fallbackLanguage,
  interpolation: { escapeValue: false },
})

export default i18n
export type { SupportedLanguage } from './resolve-language'
export { fallbackLanguage, resolveLanguage, supportedLanguages } from './resolve-language'
