# Fase 10 · Notificaciones push colaborativas con Expo Notifications

- Estado: **completada** (código, base de datos PostgreSQL, RLS 56/56, Realtime 18/18, tests unitarios, tipado estricto y export de Android superados).
- Inicio: 2026-09-06 · Cierre: 2026-09-06.
- Alcance técnico:
  - **Ecosistema Expo Notifications**: Librerías `expo-notifications` y `expo-device` con configuración en `app.json` (canal Android de alta prioridad, icono y color corporativo `#208AEF`).
  - **Seguridad y RLS en PostgreSQL**: Tabla `member_push_tokens` con políticas RLS para garantizar que nadie pueda consultar ni usar tokens de listas ajenas.
  - **RPCs en Supabase**:
    - `register_push_token`: Registra/actualiza el token de un miembro activo validando el formato de Expo.
    - `unregister_push_token`: Elimina el token del usuario actual.
    - `get_community_push_tokens`: Devuelve los tokens del resto de participantes de la lista, **excluyendo al propio autor** para evitar la auto-notificación.
  - **Despacho colaborativo**: Integrado en las mutaciones de `useAddItem` y `useCreateExpense` con llamadas asíncronas y no bloqueantes a la API de Expo Push (`https://exp.host/--/api/v2/push/send`).
  - **Deep Linking y apertura**: Listener de notificaciones para redirigir a `/list` o `/expenses` al pulsar la alerta.
- Documento de diseño: [ADR-0020](../adr/ADR-0020-notificaciones-push-con-expo.md).

---

## Desglose de incrementos de trabajo

### Incremento 1 · Dependencias y configuración en app.json

1. **Instalación de paquetes:**
   - `expo-notifications` (`~0.32.17`) y `expo-device` (`~8.0.10`).
2. **Config Plugin en `app.json`:**
   - Plugin `expo-notifications` configurado con icono (`./assets/icon.png`), color `#208AEF` y canal `default` con sonido.
3. **Mocks para Jest en `jest.setup.js`:**
   - Implementados mocks completos para `expo-notifications` (`setNotificationHandler`, `setNotificationChannelAsync`, `getPermissionsAsync`, `requestPermissionsAsync`, `getExpoPushTokenAsync`, `addNotificationResponseReceivedListener`, etc.) y `expo-device` (`isDevice: true`).

---

### Incremento 2 · Base de datos, RLS y tipado

1. **Migración PostgreSQL (`supabase/migrations/20260906160000_push_notifications.sql`):**
   - Tabla `member_push_tokens` (`id`, `community_id`, `auth_user_id`, `expo_push_token`, `device_name`, `created_at`, `updated_at`).
   - Políticas RLS:
     - Select: Miembros de la misma comunidad.
     - Insert/Update/Delete: Limitado al propio `auth.uid()` para comunidades donde es miembro.
   - Funciones RPC con `SECURITY DEFINER`:
     - `register_push_token(p_community_id, p_expo_push_token, p_device_name)`
     - `unregister_push_token(p_expo_push_token)`
     - `get_community_push_tokens(p_community_id)` -> excluye `auth.uid() = auth_user_id`.
2. **Despliegue a Supabase:**
   - Aplicada a la base de datos remota con `npx supabase db push --linked --yes`.
   - Regenerados tipos TypeScript en `src/shared/lib/db.types.ts`.
3. **Pruebas de aislamiento RLS (`scripts/rls-isolation-test.mjs`):**
   - 5 nuevas comprobaciones automáticas añadidas a la suite:
     - Registro de push token por miembro autorizado.
     - Bloqueo de registro en comunidad ajena (HTTP 403).
     - Validación de que `get_community_push_tokens` no devuelve el token propio.
     - Validación de entrega del token a los demás miembros de la lista.
     - Comprobación de que al desregistrar el token desaparece de la lista de destinatarios.
   - Resultado: **56/56 checks OK**.

---

### Incremento 3 · Feature de Notificaciones (`src/features/notifications/`)

1. **Dominio (`domain/`):**
   - `push-token.ts`: Validador formal de tokens Expo (`Expo(nent)?PushToken[...]`) y limpiador.
   - `notifications-repository.ts`: Interfaz del repositorio con tipos `CommunityNotification` y métodos `registerToken`, `unregisterToken` y `notifyCommunity`.
   - Tests unitarios en `push-token.test.ts`.
2. **Infraestructura y Datos (`data/`):**
   - `supabase-notifications-repository.ts`: Invoca los RPCs de Supabase y despacha mensajes por lotes (hasta 100 por petición) hacia `https://exp.host/--/api/v2/push/send`.
   - Captura de errores silenciosa vía `captureError` (Sentry) para no interrumpir operaciones de usuario.
   - Tests unitarios en `supabase-notifications-repository.test.ts`.
3. **Presentación y Hooks (`presentation/`):**
   - `use-push-notifications.ts`:
     - Configura el canal de Android con `AndroidImportance.HIGH`.
     - Verifica dispositivo físico (`Device.isDevice`).
     - Solicita permisos con `requestPermissionsAsync()`.
     - Obtiene y registra el token en Supabase.
     - Registra suscripción de respuesta (`addNotificationResponseReceivedListener`) para deep linking a `/list` o `/expenses`.
   - Tests unitarios en `use-push-notifications.test.ts`.

---

### Incremento 4 · Integración en UI, Mutaciones e i18n

1. **Textos internacionalizados (`i18n`):**
   - Añadidas claves `notifications.itemAddedTitle`, `notifications.itemAddedBody`, `notifications.expenseAddedTitle`, `notifications.expenseAddedBody` en `es.json` y `en.json`.
2. **Ciclo de vida en `ItemsScreen.tsx`:**
   - Invocación de `usePushNotifications(community.id)` en `ItemsView` para vincular automáticamente el token al entrar a la lista.
3. **Despacho reactivo en mutaciones:**
   - En `useAddItem` (`onSuccess`): Notifica a los demás miembros `{quantity}x {name} añadido a la lista` con enlace a `/list`.
   - En `useCreateExpense` (`onSuccess`): Notifica `{amount} en {description}` con enlace a `/expenses`.

---

## Resultados de validación técnica

1. **Batería de tests unitarios y de integración (`npm test`):**
   - **54 suites ejecutadas, 54 pasadas (100%)**.
   - **385 tests ejecutados, 385 pasados (100%)**.
2. **Tipado estricto (TypeScript strict):**
   - `npm run typecheck`: **0 errores**.
3. **Calidad de código y Linter:**
   - `npm run lint`: **0 errores / 0 warnings**.
4. **Seguridad y backend (RLS & Realtime):**
   - `npm run test:rls`: **56/56 comprobaciones de aislamiento correctas**.
   - `npm run test:realtime`: **18/18 comprobaciones de propagación en tiempo real correctas**.
5. **Exportación y empaquetado Android (Hermes):**
   - Verificado con `npx expo export --platform android`.
