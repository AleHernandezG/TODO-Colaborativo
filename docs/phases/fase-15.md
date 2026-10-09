# Fase 15: Varias listas a la vez

- **Fecha:** 2026-10-05
- **Estado:** Código, pruebas automáticas y build completados. Falta verlo en el Android real.
- **Commit:** Pendiente, lo lanza el usuario
- **Decisión de fondo:** [ADR-0025](../adr/ADR-0025-varias-listas-por-usuario-y-lista-activa.md)

---

## 1. Qué problema resuelve

Para pasar de una lista a otra había que salir, volver a la portada y entrar de nuevo con código,
nombre y PIN. Ahora el título de la lista es un selector: se toca, se elige otra y la pantalla
cambia. Desde ese mismo diálogo se crea una lista nueva o se entra en otra con un código sin
abandonar la actual.

No hay migración. Todo lo que hacía falta en el servidor ya existía.

## 2. Qué se hizo, por incrementos

### Incremento 1: datos

- `community/domain/my-memberships.ts`: `sortMemberships`, `withMembership`, `findMembership` y
  `checkActiveMembership`. Funciones puras, con sus tests.
- `CommunityRepository.listMine()` en el puerto y en el adaptador de Supabase. Empieza por
  `assertOnline()`, envuelve el error con `serverError('members.selectMine', ...)` y lanza si una
  fila llega sin su comunidad.
- `scripts/rls-isolation-test.mjs`: cinco comprobaciones nuevas sobre la consulta exacta que hace
  el adaptador.

### Incremento 2: selector

- `shared/ui/PickerDialog.tsx`: diálogo de Paper con zona con scroll y un botón de cerrar. Es
  presentacional y no sabe nada de listas.
- `community/presentation/components/`: `MembershipList` (grupo de radio), `CommunitySwitcher`
  (el título que abre el diálogo) y `MyListsShortcut` (mis listas en la portada).
- `community/presentation/hooks/`: `use-my-communities`, `use-enter-community`,
  `use-open-community` y `use-active-membership-sync`.
- `use-create-community` y `use-join-community` entran en la lista con `useEnterCommunity`, que
  la añade a la caché de mis listas antes de dejarla activa.
- `ItemsScreen`: el título pasa a ser el selector, la vista se monta con `key={community.id}` y
  desaparece el botón "Salir de esta lista" junto con sus dos claves de i18n.
- Portada (`src/app/index.tsx`): si la sesión ya pertenece a alguna lista, se ofrecen encima de
  los botones de crear y unirse.
- Espacio de nombres `lists` en `es.json` y `en.json`.

### Incremento 3: notificaciones

- `usePushNotifications(communityIds, onOpenCommunity)` registra el token en todas mis listas con
  `Promise.allSettled`, para que el fallo en una no deje sin registrar las demás.
- `notifyCommunity` añade `communityId` a los datos del push.
- Al tocar una notificación con `communityId`, se abre esa lista y después se navega. Si no
  pertenezco a ella, no se navega.

## 3. Verificación

| Comprobación                          | Resultado                                  |
| ------------------------------------- | ------------------------------------------ |
| `npm run typecheck`                   | Limpio                                     |
| `npm run lint`                        | 0 errores (9 avisos que ya estaban)        |
| `npm test`                            | 66 suites, 483 tests en verde              |
| `npm run test:rls`                    | 70/70 contra el proyecto remoto            |
| `npx expo export --platform android`  | Bundle generado                            |
| Android real                          | Pendiente                                  |

Pruebas nuevas: dominio de mis listas, `listMine` en el adaptador, los tres hooks de presentación
con un `QueryClient` de verdad, `CommunitySwitcher`, `MyListsShortcut`, el registro del token en
varias listas y el toque sobre una notificación.

## 4. Cómo probarlo a mano

Con un Android y, para los pasos 6 y 7, un segundo móvil.

1. Abre la app con una lista ya creada. El título lleva un `▾`. Tócalo: sale "Tus listas" con esa
   lista marcada como "Abierta" y el texto "Por ahora solo estás en esta lista".
2. Pulsa "Crear otra lista", rellena y guarda. Vuelves a la pantalla de lista ya dentro de la
   nueva. El botón atrás del sistema no debe devolverte al formulario.
3. Abre el selector y toca la primera. Cambian el título, los artículos y el código de invitación
   del pie. Con TalkBack se anuncia "Ahora estás en…".
4. En el selector, pulsa "Unirme con un código" y cancela con el botón atrás de Android. Tienes
   que volver a la lista en la que estabas.
5. Cierra la app del todo y ábrela: arranca en la última lista que tenías abierta.
6. Desde el segundo móvil, siendo admin, quita al primero de la lista que tiene abierta. Al volver
   a primer plano, el primero pasa solo a su otra lista con el aviso "Ya no estás en…".
7. Con el primer móvil en la lista A, añade un artículo en la lista B desde el segundo. Llega la
   notificación; al tocarla, la app abre la lista B.
8. Modo avión: el selector sigue enseñando las listas guardadas y deja cambiar entre ellas.

## 5. Decisiones sobre la marcha

### El store no se redujo a `activeCommunityId`

El plan inicial era dejar en Zustand solo el id y sacar el resto de la query. Se mantuvo la forma
actual (`membership`, `setMembership`, `leave`). Motivo: el valor persistido no cambia, así que
las instalaciones existentes y un rollback por aire siguen funcionando, que era la condición del
usuario; y la app conoce su lista sin red justo después de un update, cuando la caché de queries
se ha tirado. El coste es que nombre y código viven en dos sitios, y lo paga
`useActiveMembershipSync`. Desarrollado en ADR-0025.

### `leave` se queda en el store aunque ya no haya botón

Lo usa la reconciliación cuando el servidor dice que no me queda ninguna lista.

### El selector es un diálogo, no una hoja inferior

Paper solo entra en este repo para `Snackbar`, `Dialog` y `Portal` (ADR-0004), y una hoja inferior
propia con su gesto y su foco accesible es justo lo que esa regla evita construir a mano.
`PickerDialog` reutiliza el aspecto de `shared/ui/Dialog.tsx`.

### El push y la reconciliación van fuera de la vista con `key`

`ItemsScreen` tiene ahora un componente intermedio, `ActiveList`, que no se vuelve a montar al
cambiar de lista. Si el registro del token viviera dentro de la vista con `key`, cada cambio
lanzaría una RPC por lista.

### El fixture de los tests de hooks va en `__fixtures__/`

Jest trata como test cualquier fichero dentro de `__tests__/`, y un helper sin `it` hace fallar la
suite. `hooks/__fixtures__/query-wrapper.tsx` da el `QueryClient` y el envoltorio.

### `test:rls` usa comunidades propias para el caso nuevo

Las dos listas de la prueba se crean aparte en vez de reutilizar A y B, porque varias
comprobaciones posteriores cuentan los miembros de B y un invitado más las habría descuadrado.

### La prueba en dispositivo va con un APK nuevo, la 1.3.0, y no por aire

La rama lleva además la subida a SDK 57, que el usuario decidió al actualizarse los dispositivos
de prueba. El APK instalado, la 1.2.0, es SDK 54, y el `runtimeVersion` sale de la `version` de
`app.json`. Publicar un update con la `version` sin tocar habría mandado un bundle de SDK 57 a
todos los móviles con la 1.2.0. Se subió a 1.3.0 y se lanzó `eas build --profile preview`: quien
tenga la 1.2.0 se queda como está.

El primer build falló en `npm ci` porque a `package-lock.json` le faltaban nueve paquetes de la
subida. Se regeneró con `npm install` y `npm ci --dry-run` pasa.

### Los parches de Expo se alinearon aparte, en la 1.3.1

El build de la 1.3.0 salió con `expo doctor` avisando de 19 paquetes de Expo algún parche por
detrás de lo que espera SDK 57. No se tocaron con ese build en marcha: varios son módulos nativos
(`expo-updates`, `expo-notifications`, `expo-router`) y cambiarlos en local después de subir el
árbol dejaría el JS desalineado con el binario, que es el mismo problema de arriba en pequeño.

El 2026-10-09, con el build terminado, se lanzó `npx expo install --fix` y se subió la `version`
a 1.3.1. Tres cosas que deja:

- El comando añadió por su cuenta tres config plugins a `app.json`: `expo-image`,
  `expo-localization` y `expo-sharing`. Es configuración nativa, otro motivo para que esto vaya
  en build nuevo y no por aire.
- `typescript` está en `expo.install.exclude` de `package.json`. SDK 57 espera la 6.0 y el
  proyecto sigue en 5.9: es un salto mayor que no entra en el APK y merece su propia pasada de
  typecheck y lint. Sin esa exclusión `expo doctor` falla siempre por lo mismo y tapa lo demás.
- Comprobado después: `expo-doctor` 21/21, `npm ci --dry-run`, typecheck, lint sin errores, 483
  tests y `expo export --platform android`.

La 1.3.0 queda como build de paso. Un update por aire desde este árbol va a la 1.3.1, no a ella.

## 6. Deuda asumida

- TypeScript 6, excluido a propósito de la comprobación de Expo.
- `docs/guias/auditoria-dependencias.md` y ADR-0008 siguen razonando con Expo Go 54. La guía hay
  que repasarla; el ADR no se edita, y si se quiere MMKV ahora que hay APK propio, es un ADR nuevo.
- No se ha visto en un dispositivo. Hasta recorrer el guion de arriba, la fase no está cerrada.
- Abrir la app en frío tocando una notificación no lleva a ningún sitio concreto. Ya pasaba.
- Si me quitan de una lista, mi token de push sigue guardado en `member_push_tokens`. No llega
  nada, porque `get_community_push_tokens` filtra por `removed_at is null`, pero la fila queda.
- No hay forma de darse de baja uno mismo de una lista. Antes tampoco: el botón solo lo simulaba.
