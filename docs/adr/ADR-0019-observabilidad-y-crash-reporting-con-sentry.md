# ADR-0019: Observabilidad y crash reporting en producción con Sentry

- Estado: Aceptado y verificado (SDK integrado, bundle exportado en Android y suite Jest en verde)
- Fecha: 2026-09-06

## Contexto

Tras completar todas las funcionalidades núcleo y post-MVP (RF-1 a RF-12), la app se distribuye como binario autónomo para Android y se actualizará por aire mediante EAS Update. 

En producción o en betas no asistidas, los errores inesperados (excepciones de JavaScript no capturadas, fallos en la cola offline, errores silenciosos de replicación Realtime o problemas de red atípicos) no dejan rastro visible para los desarrolladores más allá de que el usuario cierre la app o la lista no se actualice.

Necesitamos una solución de observabilidad que:
1. Capture excepciones no controladas y fallos de renderizado en React Native sin alterar la experiencia de usuario.
2. Funcione de forma desacoplada: si no hay DSN configurado (por ejemplo, en desarrollo local o en tests automatizados), la app debe funcionar de forma 100% silenciosa y sin penalización de rendimiento.
3. Se integre con el flujo de build de Expo y EAS (subida de sourcemaps para desofuscar trazas de Hermes).
4. Respete estrictamente la privacidad: **cero PII** (sin registrar correos, nombres reales ni PINs de 4 dígitos en los eventos).

## Decisión

Adoptar **Sentry** a través del SDK oficial `@sentry/react-native` con el plugin de configuración para Expo (`@sentry/react-native/expo`).

### Principios de la integración

1. **Capa desacoplada (`src/shared/lib/observability.ts`):**  
   Ningún componente de UI ni caso de uso de `domain/` importa `@sentry/react-native` directamente. Todo pasa por la abstracción de observabilidad (`initObservability`, `captureError`, `captureMessage`, `addBreadcrumb`, `setObservabilityUser`, `wrapRootLayout`).
2. **Sanitización exhaustiva (`sanitizeData`):**  
   Cualquier contexto o breadcrumb adjuntado a un error pasa por una función de sanitización recursiva que detecta claves sensibles como `pin`, `pin_hash`, `password`, `token` o `auth` y las sustituye por `[FILTERED]`.
3. **Identidad no intrusiva:**  
   Al asociar usuario en Sentry (`setObservabilityUser`), únicamente se envía el identificador de sesión anónimo (`userId` de Supabase Auth).
4. **Captura centralizada de fallos (`logFailure`):**  
   La función existente `logFailure` en `src/shared/lib/errors.ts` (invocada por el hook `useFailureMessage` que respalda todas las mutaciones) reporta automáticamente a Sentry los fallos de tipo `rejected` (rechazados por el backend/RLS) y `unknown` (inesperados), omitiendo los de tipo `offline` y `timeout` para evitar saturar la cuota con pérdidas de cobertura normales.
5. **Envoltorio en la raíz:**  
   `RootLayout` en `src/app/_layout.tsx` se envuelve con `wrapRootLayout` (`Sentry.wrap`), garantizando el rastreo del árbol de componentes de React.

## Alternativas consideradas

- **Firebase Crashlytics:** Muy potente para apps Android puras, pero exige configuración de archivos `google-services.json`, dependencias de Google Play Services pesadas y una integración con Expo Router menos fluida que Sentry.
- **Bugsnag:** Excelente soporte para React Native, pero con un nivel gratuito más restrictivo y menor integración out-of-the-box con los plugins de Expo SDK 54.
- **Solo logs locales en consola:** Inútil en producción; los errores en dispositivos de usuarios no se reportan a ningún servidor centralizado.

## Consecuencias

- **Positivas:**  
  - Trazabilidad inmediata de incidencias en producción con pila de llamadas legible.
  - Cero dependencias duras en tiempo de test (mock limpio en `jest.setup.js`).
  - Degradación elegante: sin `EXPO_PUBLIC_SENTRY_DSN`, Sentry no inicializa ni envía peticiones de red.
  - Compatibilidad verificada con el exportador Hermes de Android (`npx expo export --platform android`).
- **Negativas / Obligaciones:**  
  - Al incorporar código nativo en el binario, cualquier APK anterior de prueba debe reinstalarse para contar con la captura nativa de ANR (aunque el código JavaScript ya opera bajo Expo Go).
  - Es necesario configurar `EXPO_PUBLIC_SENTRY_DSN` en los entornos de EAS (`eas env:set`).
