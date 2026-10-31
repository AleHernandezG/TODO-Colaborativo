---
name: probar-en-android
description: Prepara y recorre la prueba de un cambio en un Android real, con el APK de preview, un update por aire o el development build. Úsala al escribir el guion «Cómo probarlo a mano» de un incremento, antes de dar por terminado un cambio que se ve en pantalla, al cerrar un paquete, o cuando algo funciona en Jest y no en el móvil.
---

# Probar en el Android real

Android manda (`CLAUDE.md`, Plataforma objetivo). Un incremento no está terminado porque compile:
está terminado cuando se ha visto en el móvil. La sesión no tiene el móvil delante, así que su
trabajo es dejar el guion exacto, preparar lo que se puede automatizar y leer bien lo que Alejandro
cuenta que ve.

## Antes de probar

1. **Qué binario lleva el cambio.** Solo JS: update por aire sobre la runtime de `app.json`. Algo
   nativo: build nuevo con la skill `publicar-version`. Para desarrollo, `npx expo start` con el
   development build (`expo-dev-client` está instalado).
2. **Qué versión tiene el móvil.** El pie de la pantalla de lista dice `v<version> · base` o
   `v<version> · <id del update>`. Se comprueba antes del primer paso del guion; un fallo con la
   versión equivocada no es un fallo.
3. **Dos móviles** si el cambio toca Realtime, presencia, notificaciones o la cola offline. Un cambio
   de sincronización probado en un solo cliente no está probado.

## El guion

Pasos numerados, cada uno con lo que se hace y lo que se tiene que ver. Siempre entran:

- el camino principal del cambio con datos reales de una lista de prueba, nunca de una lista de
  otra persona
- **sin red**: modo avión, el cambio, cerrar la app del todo, abrirla, quitar el modo avión. Nada se
  duplica y nada se pierde (ADR-0009, ADR-0010)
- **el botón atrás del sistema** en cada pantalla nueva, y en los diálogos. Retroceso predictivo
  apagado a propósito (`predictiveBackGestureEnabled: false` en `app.json`)
- **TalkBack**: cada control nuevo se anuncia con su nombre y su papel. El procedimiento está en
  `docs/guias/prueba-de-cierre-en-dispositivo.md`, apartado 4
- **tamaño de fuente del sistema al máximo** y **modo oscuro**
- **área táctil**: Android recomienda 48 × 48 dp con 8 dp de separación; Accessibility Scanner de
  Google lo mide en el propio móvil. `CLAUDE.md` pide ≥ 44 pt (pregunta P-02 abierta)

## Lo que se automatiza

Lo que se repite en cada fase (crear lista, añadir, marcar, borrar con deshacer, cola offline) está en
`.maestro/`: `npm run test:e2e`, con el CLI de Maestro, `adb` y el APK instalado. No funciona con
Expo Go. Maestro busca un `testID` como `id` y un texto o `accessibilityLabel` como `text`; un
cambio de un texto de `es.json` rompe el flujo que lo cita literal. Detalle y por qué unos selectores
son `id` y otros texto en `docs/guias/e2e-con-maestro.md`. Cada ejecución deja una lista real en
Supabase.

## Al terminar

El resultado, paso por paso, en `docs/phases/fase-N.md`: qué versión se probó, en qué móvil, qué
pasó y qué no. Un paso no recorrido es «no comprobado», no «correcto».

## Fuentes

- Android, área táctil: https://developer.android.com/guide/topics/ui/accessibility/apps y
  https://support.google.com/accessibility/android/answer/7101858 (consultadas el 2026-10-31)
- Maestro con React Native: https://docs.maestro.dev/get-started/supported-platform/react-native
  (2026-10-31)
- Runtime de EAS Update: https://docs.expo.dev/eas-update/runtime-versions/ (2026-10-31)
