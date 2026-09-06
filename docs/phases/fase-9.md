# Fase 9 · Observabilidad y preparación para release Android (Sentry + EAS)

- Estado: **completada** (código, tests unitarios, tipado estricto, build Hermes de Android y export superados).
- Inicio: 2026-09-06 · Cierre: 2026-09-06.
- Alcance técnico:
  - **Observabilidad en producción con Sentry**: SDK `@sentry/react-native` (~7.2.0) integrado mediante config plugin en Expo SDK 54, wrapper en `RootLayout`, sanitización recursiva de PINs y datos sensibles, y captura de fallos de servidor e incidencias inesperadas.
  - **Degradación silenciosa y offline**: Si `EXPO_PUBLIC_SENTRY_DSN` no está configurado (por ejemplo, en desarrollo local o testing), la capa de observabilidad no arroja excepciones ni bloquea la app.
  - **Pipeline de Release en Android (EAS)**: Configuración validada de perfiles `preview` (APK standalone) y `production` (AAB para Google Play) con Hermes y subida de sourcemaps.
- Documento de diseño: [ADR-0019](../adr/ADR-0019-observabilidad-y-crash-reporting-con-sentry.md).

---

## Desglose de incrementos de trabajo

### Incremento 1 · Dependencias e instalación de Sentry

1. **Instalación de paquetes:**
   - `npx expo install @sentry/react-native` seleccionó la versión `~7.2.0` alineada con Expo SDK 54 y React Native 0.81.
2. **Config Plugin en `app.json`:**
   - Añadido `@sentry/react-native` en el array de plugins de Expo para gestionar el soporte nativo en Android/iOS y la subida de símbolos/sourcemaps durante builds de EAS.
3. **Mock de testing en `jest.setup.js`:**
   - Espías para `init`, `wrap`, `captureException`, `captureMessage`, `addBreadcrumb`, `setUser`, `setTag` y `setContext`, asegurando que toda la suite Jest se ejecute aislada de la red.

---

### Incremento 2 · Capa desacoplada de observabilidad

1. **Módulo central (`src/shared/lib/observability.ts`):**
   - Función pura `sanitizeData<T>(data: T)`: inspecciona claves de forma recursiva sustituyendo patrones como `/pin/i`, `/password/i`, `/token/i` y `/secret/i` por `[FILTERED]`.
   - `initObservability(dsn)`: inicializa Sentry si hay un DSN disponible y no estamos en `NODE_ENV === 'test'`, configurando muestreo de trazas al 20% y hook `beforeSend` para filtrar contexto y breadcrumbs.
   - Helpers: `captureError`, `captureMessage`, `addBreadcrumb`, `setObservabilityUser` y `wrapRootLayout`.
2. **Tests unitarios (`src/shared/lib/__tests__/observability.test.ts`):**
   - 10 tests cubriendo sanitización en objetos anidados y arrays, protección ante valores nulos, activación/desactivación por DSN, y delegación de wrappers.

---

### Incremento 3 · Integración con sesión, errores y UI

1. **Envoltorio en la raíz (`src/app/_layout.tsx`):**
   - Invocación de `initObservability()` en el arranque del layout raíz.
   - Envoltorio de `RootLayout` con `wrapRootLayout(RootLayout)` para capturar errores de renderizado en React.
2. **Contexto de sesión (`src/features/session/presentation/hooks/use-session-bootstrap.ts`):**
   - Al autenticar o restaurar sesión, asocia `setObservabilityUser({ id: session.userId })`.
   - Ante errores no atribuibles a pérdida de cobertura offline (`reason !== 'offline'`), envía la traza a `captureError`.
3. **Captura global de fallos (`src/shared/lib/errors.ts`):**
   - Actualizada la función `logFailure`: los errores clasificados como `rejected` o `unknown` (invocados por mutaciones fallidas o respuestas de error de Postgres/RLS) se capturan automáticamente en Sentry junto con la operación y el código devuelto.

---

### Incremento 4 · Preparación de EAS para Release y Documentación

1. **Variables de entorno (`.env.example`):**
   - Documentada `EXPO_PUBLIC_SENTRY_DSN` para su registro en local o en EAS mediante `npx eas-cli@latest env:set`.
2. **Perfiles de build en `eas.json`:**
   - `preview`: genera APK independiente para instalación directa y pruebas de QA sin Metro.
   - `production`: genera `.aab` (Android App Bundle) optimizado para Play Console con versionado automático (`autoIncrement: true`).
3. **Actualización de guías:**
   - Incorporación de las instrucciones de configuración de Sentry y comandos de release en `docs/guias/despliegue.md`.

---

## Resultados de validación técnica

1. **Batería de tests unitarios y de integración (`npm test`):**
   - **51 suites ejecutadas, 51 pasadas (100%)**.
   - **373 tests ejecutados, 373 pasados (100%)**.
2. **Tipado estricto (TypeScript strict):**
   - `npm run typecheck`: **0 errores**.
3. **Calidad de código y Linter:**
   - `npm run lint`: **0 errores / 0 warnings**.
4. **Exportación y empaquetado Android (Hermes):**
   - `npx expo export --platform android`: **compilación limpia completada sin incidencias** (bundle `_expo/static/js/android/entry-*.hbc` generado en 7.04 MB con 2.195 módulos).
5. **Seguridad y backend:**
   - `npm run test:rls`: 51/51 comprobaciones de aislamiento correctas.
   - `npm run test:realtime`: 18/18 comprobaciones de propagación en tiempo real correctas.

---

## Guión de verificación en dispositivo físico

1. **Desarrollo / Expo Go:**
   - Arrancar con `npx expo start`.
   - Comprobar que la app inicia con normalidad, sin bloqueos ni errores por ausencia de DSN de Sentry.
2. **Prueba con Sentry DSN (opcional):**
   - Añadir temporalmente `EXPO_PUBLIC_SENTRY_DSN="https://...@o...ingest.sentry.io/..."` en `.env`.
   - Provocar un error controlado (o forzar una mutación inválida).
   - Verificar en el panel de Sentry que el evento llega registrado con `userId` anónimo y que ningún PIN ni dato sensible aparece en las etiquetas ni en la información adjunta.
3. **Generación de APK de Release con EAS:**
   - Ejecutar `npx eas-cli@latest build --platform android --profile preview`.
   - Descargar e instalar el APK generado para validar el funcionamiento autónomo fuera del entorno de desarrollo.
