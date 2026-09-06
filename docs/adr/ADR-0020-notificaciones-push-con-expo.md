# ADR-0020: Notificaciones push colaborativas con Expo Notifications

- Estado: Aceptado y verificado (migración aplicada, RLS 56/56 checks OK, Jest en verde)
- Fecha: 2026-09-06

## Contexto

En una lista de compras y gastos compartida, los canales de Supabase Realtime (WebSockets) mantienen la sincronización instantánea mientras los miembros tienen la app abierta. Sin embargo, cuando la aplicación está en segundo plano o el dispositivo está bloqueado, los miembros no se enteran de que alguien ha añadido artículos a la lista o ha registrado un nuevo gasto común.

Para cerrar esta brecha colaborativa, es necesario un sistema de notificaciones push que:
1. Solicite permisos y registre el token del dispositivo de forma transparente al abrir una lista activa.
2. Evite la auto-notificación: quien añade el artículo o el gasto no debe recibir una alerta de su propia acción.
3. Cumpla con el aislamiento RLS: ninguna comunidad ni usuario puede ver o utilizar los tokens push de otra lista.
4. Tenga entrega "best-effort" sin bloquear las mutaciones optimistas ni la cola offline: un fallo en el servicio de push nunca debe impedir que un artículo o gasto se guarde localmente.
5. Sea compatible con Android 8.0+ mediante canales de notificación configurados explícitamente.

## Decisión

Adoptar el ecosistema **Expo Notifications** (`expo-notifications` y `expo-device`) junto con el servicio de entrega **Expo Push Service**.

### 1. Modelo de Datos y Seguridad en PostgreSQL (`member_push_tokens`)

- Se creó la tabla `member_push_tokens` vinculada a la comunidad y al usuario autenticado (`auth_user_id`), indexada por `(community_id, expo_push_token)`.
- RLS activado con políticas de inserción, actualización, consulta y borrado restringidas a los miembros activos de la comunidad (`community_members`).
- Funciones RPC con `SECURITY DEFINER`:
  - `register_push_token`: Registra o actualiza el token (`ON CONFLICT DO UPDATE updated_at = now()`), validando formato Expo (`Expo(nent)?PushToken[...]`) y membresía.
  - `unregister_push_token`: Elimina el token del usuario actual.
  - `get_community_push_tokens(p_community_id)`: Obtiene los tokens activos de los demás miembros de la comunidad, **excluyendo explícitamente al emisor actual (`auth.uid()`)**.

### 2. Capa de Dominio y Validación

- `src/features/notifications/domain/push-token.ts`: Valida tokens de Expo Push mediante regex formal y extrae el identificador limpio.
- `src/features/notifications/domain/notifications-repository.ts`: Define la interfaz abstracta `NotificationsRepository` para registro y envío a la comunidad.

### 3. Envío y Despacho (`src/features/notifications/data/supabase-notifications-repository.ts`)

- La función `notifyCommunity` obtiene los tokens ajenos mediante el RPC y despacha los mensajes en lotes de hasta 100 destinatarios al endpoint de la API de Expo (`https://exp.host/--/api/v2/push/send`).
- El payload incluye título, cuerpo, sonido por defecto, prioridad alta y datos adicionales para deep linking (`url: '/list'` o `url: '/expenses'`).
- Cualquier error de red o de la API de Expo se captura y se envía a Sentry (`captureError`) con categoría `push-notifications`, garantizando que la promesa nunca rechace ni bloquee la UI.

### 4. Ciclo de Vida en la Presentación (`usePushNotifications`)

- El hook `usePushNotifications(communityId)` se monta en `ItemsView` (`ItemsScreen.tsx`):
  1. Configura el canal Android `default` con `AndroidImportance.HIGH` y vibración.
  2. Verifica que sea un dispositivo físico (`Device.isDevice`).
  3. Solicita permisos al usuario si aún no han sido concedidos.
  4. Obtiene el token con `Notifications.getExpoPushTokenAsync({ projectId })`.
  5. Lo registra en Supabase para la comunidad activa.
  6. Escucha la respuesta al tocar una notificación (`addNotificationResponseReceivedListener`) para dirigir al usuario a la pantalla correspondiente mediante `router.push()`.

## Alternativas consideradas

- **Firebase Cloud Messaging (FCM) directo:** Requiere configurar credenciales de Google Cloud, añadir `google-services.json`, y gestionar tokens FCM nativos distintos para Android e iOS. Expo Push Service abstrae FCM y APNs sin configuración nativa adicional en el cliente.
- **OneSignal:** Plataforma de terceros muy completa pero con dependencias más pesadas y cuotas comerciales.
- **Supabase Database Webhooks a Edge Functions:** Muy limpio a nivel de backend, pero requiere configurar secretos de Expo en Supabase Edge Functions y añade latencia de invocación de función sin frío adicional. El despacho desacoplado desde el cliente autenticado es inmediato y no requiere infraestructura extra.

## Consecuencias

- **Positivas:**
  - Experiencia colaborativa completa: los compañeros de piso reciben avisos inmediatos en la barra de estado cuando alguien hace compras o añade gastos.
  - 100% cubierto por pruebas unitarias de Jest con mocks exhaustivos de `expo-notifications` y `expo-device`.
  - 5 tests de aislamiento RLS añadidos a `scripts/rls-isolation-test.mjs` (56/56 checks correctos).
  - No intrusivo: no molesta al autor de la acción con alertas redundantes.
- **Negativas / Obligaciones:**
  - En emuladores o simuladores de escritorio, `Device.isDevice` devuelve `false` y el registro se omite de forma segura. Requiere dispositivo físico o APK compilado con EAS para recibir notificaciones reales en segundo plano.
