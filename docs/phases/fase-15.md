# Fase 15: Varias listas a la vez

- **Fecha:** 2026-10-05 (abierta) · 2026-10-09 (versión 1.3.1) · 2026-10-11 (fusión en `main`)
- **Estado:** Código, pruebas automáticas y build completados. Falta verlo en el Android real.
- **Commit:** En la rama `feat/expo-sdk-57`: `4f08737`, `77255bd`, `1fc0dab`, `fb0dab5`, `a364876`.
  Fusión en `main`: `febae87` (2026-10-12), subido a GitHub.
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
| `npm run test:rls`                    | 70/70 contra el proyecto remoto, en la rama. Sin repetir tras la fusión (apartado 7) |
| `npm run test:realtime`               | No ejecutado en esta fase. El script tiene 18 comprobaciones |
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

## 7. Fusión de `feat/expo-sdk-57` en `main` (2026-10-11)

### Qué se cambió

La rama `feat/expo-sdk-57` (5 commits, de `4f08737` a `a364876`) se fusionó en `main` (commit `febae87`). Con eso
`main` pasa a ser SDK 57, versión 1.3.1, y contiene el selector de listas de esta fase, `DESIGN.md`
y ADR-0025. Hasta hoy `main` seguía en SDK 54 y versión 1.2.0, mientras los únicos APK descargables
(1.3.0 y 1.3.1, del 2026-10-09) se habían construido desde la rama.

Conflictos: uno solo, `docs/phases/fase-14.md`. Las dos líneas habían añadido una sección al final
del fichero: la rama, «4. Decisiones sobre la marcha» (2026-10-05); `main`, «Utillaje · Agentes del
proyecto» (2026-10-11). Se conservan las dos, en orden cronológico. `CLAUDE.md` y `eslint.config.js`
se fusionaron sin conflicto: el primero queda con el texto de SDK y de fase de la rama y con los
agentes y el plugin `pr-review-toolkit` de `main`; el segundo, con las 8 features en el array.

### Por qué

La auditoría del 2026-10-11 (`docs/auditoria-2026-10-11.md`, apartado 1) encontró que el código
instalado en los móviles no estaba en `main` y que las dos líneas se contradecían en la regla del
SDK. Había que elegir una.

**Alternativa descartada: quedarse en SDK 54 y tirar la rama.** Ahorraba dejar de usar Expo Go en el
móvil de pruebas. A cambio había que portar el selector de listas a SDK 54, dejar huérfano el APK
1.3.1 ya instalado y construir igualmente un APK nuevo de SDK 54, porque el de la 1.2.0 es del
2026-08-03 y no lleva los módulos nativos de las fases 8 a 10 (el intento del 2026-09-08 falló en
Gradle). El límite de SDK 54 era de la app Expo Go de un dispositivo, no de los móviles: un APK
lleva su SDK dentro y se instala igual.

**Alternativa descartada: mantener las dos líneas en paralelo.** Cada cambio se haría y se probaría
dos veces, para dar servicio a un APK que de todas formas hay que sustituir.

### Qué implica

- **Expo Go de SDK 54 ya no abre este proyecto.** Se prueba con el APK del perfil `preview` o con un
  development build (`npx eas-cli@latest build --platform android --profile development`), que hace
  el papel de Expo Go con el SDK y los módulos nativos del proyecto: mismo `npx expo start`, mismo
  QR. Pide build nuevo solo cuando cambia algo nativo. El development build no se ha lanzado
  todavía.
- **Un `eas update` desde `main` va ahora a la runtime 1.3.1**, no a la 1.2.0. Los móviles con el
  APK 1.2.0 no reciben nada de aquí en adelante.
- **La runtime 1.2.0 tiene publicados dos updates que su APK no puede ejecutar** («Fases 11-13»,
  grupo `5b55fc8d`, y «Fase 14», grupo `b318117c`): importan `expo-print`, `expo-sharing`,
  `expo-notifications` y `expo-device`, que el APK del 2026-08-03 no lleva. No se ha tocado; es el
  incremento 2 del plan de la auditoría.
- **Los enlaces de descarga de EAS caducan.** El del APK 1.3.1 vence el 2026-10-23. Para repartirlo
  después hace falta otro build o colgar el APK en un sitio estable.
- Esta copia del repo no tiene `.env` ni está enlazada a Supabase (`supabase link`), así que
  `test:rls`, `test:realtime` y `supabase migration list` no se pudieron ejecutar aquí.

### Verificación tras la fusión

| Comprobación                         | Resultado                                              |
| ------------------------------------ | ------------------------------------------------------ |
| `npm ci`                             | Correcto, Expo 57.0.27                                 |
| `npm run lint`                       | 0 errores, 9 avisos (`react-hooks/set-state-in-effect`) |
| `npm run typecheck`                  | Limpio                                                 |
| `npm test`                           | 66 suites, 483 tests en verde                          |
| `npx expo export --platform android` | Bundle generado (7,2 MB)                               |
| `npx expo-doctor`                    | 21/21                                                  |
| `npm run test:rls`                   | No ejecutado: falta `.env`                             |
| `npm run test:realtime`              | No ejecutado: falta `.env`                             |
| Android real                         | Pendiente                                              |

El lint pasa ya con `meal-planner`, `notifications` y `recipes` dentro del array `features`, cosa
que la rama no había comprobado: allí faltaban.

### Qué queda sin arreglar en la documentación

El agente `docs-drift-auditor` se volvió a lanzar tras la fusión, con alcance `CLAUDE.md`,
`docs/guias/despliegue.md`, este diario y los dos README: 35 discrepancias. Se corrigieron en el
mismo incremento las que eran consecuencia directa de la fusión y estaban comprobadas contra el
código:

- `CLAUDE.md`: recuento de `test:realtime` (18/18, eran 15/15), `npx expo start` ya no es «QR para
  Expo Go», lista de features y de rutas, el motivo de la regla de MMKV y la cabecera «fases 0 → 4».
- `docs/guias/despliegue.md`: el bucle diario es el development build (opción C nueva), los config
  plugins y `expo install --fix` cuentan como cambio nativo, el enlace del APK caduca, los tres
  canales, `SENTRY_DISABLE_AUTO_UPLOAD` y `EXPO_PUBLIC_SENTRY_DSN`, y el estado de las dos runtimes.
- `README.md` y `docs/README.md`: versiones, recuentos (66 suites y 483 tests, RLS 70/70), los ADR
  0023 y 0024 que faltaban en la tabla y las fases 13 y 14 que faltaban en el índice.

**Lo que se dejó sin tocar a propósito**, para el incremento 10:

- El bloque de estado de `CLAUDE.md` que cuenta las fases 5 y 6 en presente. Reescribirlo obliga a
  decidir si las fases 7 a 14 se dan por «cerradas» sin prueba en dispositivo, y esa decisión es del
  usuario.
- «Los diez ficheros de `lib/`», las variables de entorno y la fecha de los plugins en `CLAUDE.md`.
- El aviso sobre Sentry en el perfil `production` y sobre FCM en la guía de despliegue: son
  deducciones del agente que nadie ha comprobado con un build.
- Los diarios de las fases 7 a 14, que no entraban en el alcance.

### Decisiones de la rama que no estaban escritas

- **`SENTRY_DISABLE_AUTO_UPLOAD=true` en el perfil `preview` de `eas.json`.** Entró en el commit
  `1fc0dab` sin documentar. Apaga la subida de sourcemaps para que el APK compile sin token de
  Sentry; a cambio, las trazas de un APK `preview` llegan sin desofuscar. Ahora está en la guía de
  despliegue (apartado 2).
- **Tres dependencias de desarrollo nuevas**: `@react-native/jest-preset`, `react-test-renderer` y
  `test-renderer`. Llegaron con la subida a SDK 57 y ningún documento dice por qué hace falta cada
  una. Queda por averiguar y escribir.

## 8. Republicación del último update válido de la runtime 1.2.0 (2026-10-11)

Incremento 2 del plan de `docs/auditoria-2026-10-11.md` (apartado 7). No toca `src/` ni SQL. Los
comandos los lanza el usuario; aquí queda qué se comprobó antes y por qué se hace así.

### Qué pasó

El único APK de la 1.2.0 es del 2026-08-03. Después entraron en el repo módulos nativos que ese
binario no lleva, sin subir la `version` de `app.json`, y como el `runtimeVersion` sale de esa
`version`, EAS siguió dando por compatibles con él los updates publicados desde entonces. El
2026-09-08 se publicaron dos:

| Grupo      | Mensaje                                             | Qué importa que el APK no tiene                                                           |
| ---------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `5b55fc8d` | Fases 11-13: recetas, planificador de menus y fotos | `expo-print`, `expo-sharing`, `@sentry/react-native`, `expo-notifications`, `expo-device` |
| `b318117c` | Fase 14: Modo supermercado y categorias             | Lo anterior y `expo-keep-awake` como import directo                                       |

El último grupo anterior a todo eso es `96f20bba-9b89-42f7-af7f-a56f09441436` («Rebuild expense
split UI into separate routes», 2026-09-03).

### Qué se comprobó

Todo con `git`, sin tocar EAS. El APK se construyó desde el commit «Fase 3» del 2026-08-03, que en
este historial es `307ac3f`; el `8dbcee7` que apunta EAS no existe aquí porque el historial se
reescribió después (ver `fase-5.md`).

| Comprobación                                                             | Resultado                                                                                                                                                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commits con el mensaje del grupo                                         | `a1bac0d` y `f7349b3`, los dos del 2026-09-03. Solo difieren en `CLAUDE.md` y el documento maestro: mismo JS                                                                    |
| `app.json` de `307ac3f` frente a `f7349b3`                               | Idéntico: misma `version` 1.2.0, mismos plugins                                                                                                                                 |
| `dependencies` de `307ac3f` frente a `f7349b3`                           | Entran tres: `@tanstack/query-async-storage-persister`, `@tanstack/react-query-persist-client` y `expo-modules-core`                                                            |
| ¿Alguna de las tres pide binario nuevo?                                  | No. Las dos de TanStack son JS puro; `expo-modules-core@3.0.30` ya estaba en el `package-lock.json` del APK, misma versión, como transitiva de `expo`                           |
| Imports de `src/` en `f7349b3` que no están en el `package.json` del APK | Solo esas tres                                                                                                                                                                  |
| Primer commit incompatible                                               | `074adc2` (Fase 8, 2026-09-05): entran `expo-print` y `expo-sharing`                                                                                                            |
| RPC que llama ese JS frente al esquema actual                            | `create_community`, `join_community`, `rotate_join_code`, `create_expense_with_shares` y `search_catalog` siguen en las migraciones con la firma y el retorno que ese JS espera |

Son las mismas dependencias que las del grupo `1c2955a1` (commit `9b5a03c`), que sí se vio
funcionando en los dos móviles (`fase-6.md`, Tarea 3).

**Lo que no se pudo confirmar:** que el grupo `96f20bba` saliera de `a1bac0d` o de `f7349b3`. Se
deduce del mensaje y de la fecha. `eas` no está instalado en la máquina donde se hizo esto y
`npx eas-cli` no tenía sesión iniciada. Por eso el primer paso de abajo es mirarlo. Tampoco se
contrastó el esquema contra el proyecto remoto, solo contra `supabase/migrations/`: esta copia no
tiene `.env` ni está enlazada.

### Qué se hace

Dos pasos, en este orden, desde la raíz del repo. Los lanza el usuario.

**Paso 1. Confirmar el grupo.** Solo lee.

```powershell
npx eas-cli@latest update:view 96f20bba-9b89-42f7-af7f-a56f09441436
```

Tiene que decir runtime `1.2.0`, rama `preview` y fecha 2026-09-03. El commit puede no coincidir
con `a1bac0d` ni con `f7349b3` por la reescritura del historial; lo que manda es la fecha, anterior
al 2026-09-05. Apunta el id del update de Android: es el que hoy debería enseñar el pie de un móvil
sano con la 1.2.0. Si la fecha o la runtime no cuadran, no sigas.

**Paso 2. Republicar.** **Sintaxis no ejecutada**: escrita de memoria a partir de la ayuda del CLI.

```powershell
npx eas-cli@latest update:republish --group 96f20bba-9b89-42f7-af7f-a56f09441436 --destination-branch preview --message "Republica 96f20bba: ultimo update compatible con el APK 1.2.0"
```

- Si el CLI rechaza `--destination-branch` junto a `--group`, se quita: el grupo ya es de la rama
  `preview` y sin destino explícito se republica en la suya. **Sintaxis no ejecutada.**
- Se lanza desde `main` aunque `main` sea SDK 57 y versión 1.3.1: republicar reutiliza el bundle ya
  subido con su runtime 1.2.0, no empaqueta el árbol local. **No ejecutado**: es lo que el comando
  dice hacer, no algo visto aquí. Si pidiera exportar o enseñara la runtime 1.3.1, se cancela.
- Los grupos `5b55fc8d` y `b318117c` **no se borran**. Siguen en el historial de la rama, por
  detrás del republicado, y dejan de ser lo que se sirve a la runtime 1.2.0.

### Alternativas descartadas

- **Borrar los dos grupos rotos con `eas update:delete`.** Dejaría a `96f20bba` como último sin
  crear grupo nuevo, a costa de ser irreversible y de borrar la prueba de lo que pasó. Republicar
  consigue lo mismo y se puede deshacer republicando otro.
- **Volver al bundle embebido del APK.** Es el JS del 2026-08-03: no pinta el campo de PIN, y un
  miembro con `pin_hash` puesto recibiría `invalid_pin` desde una app que no puede mandarlo. Es el
  problema que resolvió el update `1c2955a1`.
- **Publicar un update «puente» con el aviso de «instala la versión nueva»** (opción 4 de la
  auditoría). Hay que construirlo desde un árbol compatible con SDK 54 y depende de la tabla de
  versión mínima, que no existe. Es el incremento 5; esto es el parche de hoy.

### Qué implica

- **El pie de un móvil con 1.2.0 enseñará un id nuevo**, el del update republicado, no el de
  `96f20bba`. Se apunta abajo cuando se lance.
- **Llega en dos arranques en frío**: `expo-updates` descarga en uno y aplica en el siguiente. Que
  un móvil con el bundle roto ya cacheado llegue a descargarlo es **deducido, no visto**: la
  comprobación la hace la parte nativa al arrancar, así que debería ocurrir aunque el JS falle. Si
  un móvil no sale de ahí, se le pasa el APK 1.3.1.
- **Al aplicarse se vacía la caché persistida de TanStack Query**, porque `cacheBuster()` de
  `src/shared/lib/query-persister.ts` incluye el id del update. El primer arranque sin red no
  tiene lista.
- **La 1.2.0 queda congelada en el código del 2026-09-03.** Ningún update desde `main` le llega,
  porque van a la runtime 1.3.1. Quien se quede en ella no tiene gestión de miembros, PDF, recetas,
  planificador, modo supermercado ni selector de listas.
- **Quien se quede en la 1.2.0 ve a los miembros archivados como participantes en gastos.** Ese JS
  es anterior a la Fase 7: su `listMembers` pide `members` filtrando solo por `community_id`, sin
  `removed_at is null`, y la política `members_select` es por comunidad y tampoco los oculta. Salen
  también los invitados (`auth_user_id` nulo), como un miembro más. No lo introduce la
  republicación, ya le pasa a cualquier móvil que siga en `96f20bba`, y no tiene arreglo por aire:
  se resuelve instalando la 1.3.1.
- **Corrección a la auditoría:** su apartado 4 dice que `01a0682a` es el id de «Rebuild expense
  split UI». No lo es: es el id de Android del grupo anterior, `1c2955a1` (`fase-6.md`, Tarea 3).
  Un móvil con 1.2.0 que enseñe `01a0682a` está un update por detrás del último válido. Queda
  anotado también en la auditoría, con fecha y sin reescribirla.
- **La regla que evita repetirlo** ya está en `CLAUDE.md` (apartado Stack) y en
  `docs/guias/despliegue.md`: dependencia nativa o config plugin nuevo es `version` nueva y build.
  Que la runtime cambie sola con `fingerprint` es el incremento 5.

### Resultado

Lo rellena el usuario al lanzarlo.

| Dato                                                 | Valor     |
| ---------------------------------------------------- | --------- |
| Paso 1: fecha, runtime y commit del grupo `96f20bba` | Pendiente |
| Paso 1: id del update de Android de `96f20bba`       | Pendiente |
| Paso 2: id del grupo republicado                     | Pendiente |
| Paso 2: id del update de Android republicado         | Pendiente |
| Pie de un móvil con 1.2.0 tras dos arranques en frío | Pendiente |

## 8. Devolver la runtime 1.2.0 a su último update compatible (2026-10-12)

Incremento 2 del plan de `docs/auditoria-2026-10-11.md`.

### Qué problema resuelve

El único APK de la runtime 1.2.0 se construyó el 2026-08-03 14:47 UTC. Los dos updates más recientes
publicados contra esa runtime llevan JS que importa módulos nativos que ese APK no tiene:

| Grupo      | Mensaje                                             | Módulos que el APK no lleva                                   |
| ---------- | --------------------------------------------------- | ------------------------------------------------------------- |
| `5b55fc8d` | Fases 11-13: recetas, planificador de menus y fotos | `expo-print`, `expo-sharing`, `expo-notifications`, `expo-device` |
| `b318117c` | Fase 14: Modo supermercado y categorias             | los mismos                                                    |

EAS sirve siempre el más nuevo de la rama, así que un móvil con la 1.2.0 recibe `b318117c`. Lo que
le pasa al cargarlo es deducido, no visto en un dispositivo: `ItemsScreen` importa
`use-push-notifications.ts`, que carga `expo-notifications` y `expo-device` al importar el módulo.

### Qué se decide

Republicar como último update de la rama `preview`, runtime 1.2.0, el grupo
`96f20bba-9b89-42f7-af7f-a56f09441436` («Rebuild expense split UI into separate routes», del
2026-09-03). Es el último anterior a la Fase 8.

`eas update:republish` no borra nada: publica una copia del grupo elegido con fecha de hoy, que pasa
a ser la más nueva. Los grupos `5b55fc8d` y `b318117c` siguen en el historial.

```bash
npx eas-cli@latest update:republish \
  --group 96f20bba-9b89-42f7-af7f-a56f09441436 \
  --message "Vuelta al ultimo update compatible con el APK 1.2.0 (anterior a Fase 8)"
```

### Cómo se comprobó que ese grupo es compatible

- El APK se construyó desde el commit `8dbcee7` («Fase 3»), que ya no está en el repo porque el
  historial se reescribió después (`docs/phases/fase-5.md`). Su equivalente es `307ac3f`, también
  «Fase 3», con fecha 2026-08-03 14:46 UTC: un minuto antes del build.
- El grupo `96f20bba` corresponde a `f7349b3` (2026-09-03), mismo mensaje. El hash exacto no se pudo
  leer de EAS porque la sesión se había perdido; se identifica por mensaje y fecha.
- Entre `307ac3f` y `f7349b3`, `package.json` solo gana tres dependencias:
  `@tanstack/query-async-storage-persister` y `@tanstack/react-query-persist-client`, que son JS
  puro, y `expo-modules-core`, que todo APK de Expo lleva dentro. `app.json` no cambia: ni
  `plugins` ni `version`.
- Todos los módulos nativos que importa `src/` en `f7349b3` estaban ya en `package.json` en
  `307ac3f`: `expo-router`, `expo-image`, `expo-image-picker`, `expo-image-manipulator`,
  `expo-clipboard`, `expo-localization`, `expo-constants`, `expo-updates`, `expo-status-bar`,
  `react-native-reanimated`, `react-native-safe-area-context`, NetInfo y AsyncStorage.
- Coincide con lo que dice `CLAUDE.md`: RF-9 llegó al móvil el 2026-09-03 con un update sobre el
  APK de la 1.2.0, y la Fase 6 se verificó en dispositivo el 2026-09-04 con él.

### Alternativas descartadas

- **Un update «puente» nuevo con un aviso de «instala la versión nueva».** Es mejor para el usuario,
  pero necesita código nuevo construido en un árbol de SDK 54 y sin los módulos de las fases 8 a 10.
  Va con el aviso de versión del incremento 5. Republicar no cuesta código y corta el daño hoy.
- **Borrar los dos grupos rotos** (`eas update:delete`). No se puede deshacer y no aporta nada que
  no dé la republicación.
- **No hacer nada**, porque esos móviles tienen que instalar el APK 1.3.1 de todas formas. Mientras
  no lo hagan se quedan con una app que puede no abrir.

### Qué implica

- Los móviles con 1.2.0 se quedan en la Fase 6: sin PDF, recetas, menús ni modo supermercado. Para
  tener más, instalan el APK 1.3.1.
- No afecta a los móviles con 1.3.x: es otra runtime.
- **No vuelvas a publicar contra la runtime 1.2.0** desde un árbol posterior a `f7349b3`.
- El servidor ya tiene las migraciones de las fases 7 a 14. El JS de `f7349b3` no filtra
  `removed_at`, así que en esos móviles un miembro archivado se sigue viendo como miembro.

### Cómo verificarlo

1. `npx eas-cli@latest update:list --branch preview --limit 3`: el primero debe ser el republicado,
   runtime 1.2.0, con el mensaje de arriba.
2. En un Android con el APK 1.2.0: abre la app, ciérrala del todo y ábrela otra vez (un update se
   descarga en un arranque y se aplica en el siguiente). Debe abrir y enseñar la lista.
3. El pie debe decir `v1.2.0 · <id>` con un id distinto de `base`.

### Resultado

Republicado el 2026-10-12 por el usuario.

| Dato              | Valor                                                                     |
| ----------------- | ------------------------------------------------------------------------- |
| Rama              | `preview`                                                                 |
| Runtime           | 1.2.0                                                                     |
| Grupo nuevo       | `c3353939-5487-4c66-b64d-6704585b3769`                                    |
| Update de Android | `01a12d00-4848-7bc7-9827-9b7757e93d22` (en el pie se verá `01a12d00`)     |
| Update de iOS     | `01a12d00-4848-753a-82a8-2c633611eed5`                                    |
| Copia de          | `96f20bba-9b89-42f7-af7f-a56f09441436`                                    |

`eas update:list --branch preview --limit 3` lo devuelve el primero, por delante de `b318117c` y
`5b55fc8d`, que siguen en el historial.

**Falta la prueba en dispositivo.** Nadie ha abierto todavía un Android con el APK 1.2.0 después de
republicar. Hasta que se haga el paso 2 de «Cómo verificarlo» y el pie enseñe `v1.2.0 · 01a12d00`,
que el update arregla esos móviles sigue siendo una deducción.
