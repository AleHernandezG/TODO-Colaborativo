import { getLocales } from 'expo-localization'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import es from './es.json'

const resources = { es: { translation: es } }

const deviceLanguage = getLocales()[0]?.languageCode ?? 'es'

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage in resources ? deviceLanguage : 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
})

export default i18n
