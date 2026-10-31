---
name: publicar-version
description: Prepara la publicación de una versión de la app, por aire con eas update o con build nuevo, y deja la orden lista sin lanzarla. Solo la lanza Alejandro.
disable-model-invocation: true
argument-hint: "[update|build] [preview|production]"
---

# Publicar una versión

Argumentos: `$ARGUMENTS`. Si falta el primero, lo decide el paso 1; si falta el canal, es `preview`.

Publicar sale del repo y llega a los móviles de otras personas, así que la orden la ejecuta
Alejandro. El hook `bloquear-escrituras-git.mjs` deniega `eas update`, `eas build` y `eas submit`
aunque esta skill se olvide. Lo que hace la sesión es comprobar que la publicación no rompe un APK
instalado y dejar la orden exacta.

El riesgo que esto evita ya pasó: el 2026-09 se publicaron dos updates sobre la runtime 1.2.0 sin
subir la `version` tras añadir módulos nativos, y ese APK revienta al ejecutarlos
(`docs/guias/despliegue.md`, apartado 5; auditoría del 2026-10-11, apartado 4).

## Procedimiento

1. **¿Update o build?** `runtimeVersion` usa la política `appVersion`: la runtime es la `version`
   de `app.json`. Mira `git diff <tag o commit del último build> -- app.json package.json`. Es build
   nuevo, con `version` subida, si cambió cualquiera de estas cosas:
   - el array `plugins` de `app.json`
   - una dependencia `expo-*`, `react-native-*` o cualquier otra con código nativo
   - permisos, icono, splash o el SDK
   - si se lanzó `npx expo install --fix`

   Si nada de eso cambió, es update por aire. Si dudas, es build: un build de más cuesta minutos,
   un update de más deja un móvil roto con el bundle ya cacheado.
2. **Comprobaciones**, apuntando el resultado de cada una:
   ```bash
   npm ci --dry-run
   npm run lint
   npm run typecheck
   npm test
   npx expo export --platform android
   ```
3. **Destino.** Di qué runtime recibe la publicación (`version` de `app.json`) y qué APK la tiene
   instalada. Nunca se publica contra la runtime 1.2.0.
4. **Variables de EAS.** Para un build, confirma con Alejandro que el entorno del perfil tiene
   `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` y `EXPO_PUBLIC_SENTRY_DSN`
   (`docs/guias/despliegue.md`, apartado 2). La sesión no las lee ni las imprime.
5. **La orden**, lista para copiar:
   - update: `npx eas-cli@latest update --branch <canal> --message "<qué cambia, en castellano>"`
   - build: `npx eas-cli@latest build --profile <perfil> --platform android`
6. **Después.** Qué tiene que decir el pie de la pantalla de lista en el móvil (`v<version> · base`
   tras un build, `v<version> · <id>` tras un update) y en qué diario se apunta el grupo o el build.

## Si algo falla

Se para en el paso que falla y se dice cuál. No se publica a medias ni se rebaja una comprobación.

## Lo que no se hace

- Subir la `version` sin build. Deja los móviles con la runtime vieja sin updates y sin aviso.
- Publicar desde una rama que no sea `main` sin que Alejandro lo diga.
- Tocar el SDK. Eso lo decide Alejandro con el móvil de pruebas delante (`CLAUDE.md`, Stack).
