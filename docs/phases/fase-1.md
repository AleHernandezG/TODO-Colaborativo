# Fase 1 · MVP CRUD local a la nube

- Estado: **5/5 incrementos hechos y probados en el APK; pendiente de luz verde para la Fase 2**
- Inicio: 2026-07-19

Entregable de la fase (§12 del documento maestro): una persona usa la lista completa contra la
nube.

Incrementos, en orden. Los tres primeros se probaron en el Android real (Expo Go) antes de
seguir. El 4 y el 5 se construyeron seguidos para llegar antes a una beta instalable y se
probaron juntos sobre el APK, no por QR (ver [despliegue](../guias/despliegue.md)).

1. [x] Sesión anónima
2. [x] Crear y unirse a comunidad por código (RF-2, RF-5) + rate limit
3. [x] Lista de artículos: leer y añadir (RF-3)
4. [x] Marcar comprado y borrar con deshacer (RF-1, RF-4 sin imagen)
5. [x] Estados vacíos, errores y repaso de accesibilidad

---

## Incremento 1 · Sesión anónima

La app pide una sesión anónima a Supabase al arrancar y la reutiliza en los siguientes
arranques. Es lo que da el `auth.uid()` del que dependen todas las políticas RLS
([ADR-0002](../adr/ADR-0002-modelo-de-sesion-y-rls.md)), así que sin esto no funciona nada de
lo que viene después.

Primera feature con las tres capas, y sirve de plantilla para las siguientes:

```
src/features/session/
├── domain/
│   ├── session.ts               la entidad
│   ├── session-repository.ts    el puerto (interfaz)
│   └── ensure-session.ts        el caso de uso, función pura
├── data/
│   └── supabase-session-repository.ts   el adaptador
└── presentation/
    ├── session-store.ts             estado de cliente (Zustand)
    ├── use-session-bootstrap.ts     arranque y reintento
    └── SessionGate.tsx              carga / error / contenido
```

`ensureSession` recibe el repositorio como parámetro en vez de importarlo. Por eso se puede
probar con un doble y sin tocar la red, y por eso `domain/` no sabe que Supabase existe.

**El estado de sesión vive en Zustand, no en TanStack Query.** No es estado de servidor: es
estado local del dispositivo. La regla de `CLAUDE.md` se aplica tal cual.

### Decisiones sobre la marcha

**`SessionGate` bloquea el árbol hasta que hay sesión.** La alternativa era dejar renderizar y
que cada pantalla se defendiera sola, lo que reparte por toda la app un caso que solo ocurre
al arrancar. A cambio, un fallo de red en el primer arranque deja al usuario en una pantalla
de error en vez de en la landing; se compensa con un botón de reintento, que es lo que la
persona va a querer hacer de todas formas.

**Los errores del adaptador se traducen a mensajes accionables.** Si Supabase responde
`anonymous_provider_disabled`, el mensaje dice literalmente dónde hay que ir a activarlo. Es
el error que más tiempo cuesta diagnosticar de este proyecto y ya nos pasó una vez en Fase 0.

**El `useEffect` de arranque consulta `getState()` en vez del `status` suscrito.** Con el
estado suscrito, React en modo estricto ejecuta el efecto dos veces y se crean dos sesiones
anónimas, o sea dos usuarios huérfanos por cada arranque en desarrollo.

### Cómo probarlo

1. `npx expo start --clear` y abre en el Android.
2. Debe verse un indicador de carga breve y luego la landing. Si se queda en la carga o sale
   la pantalla de error, el mensaje dice qué pasa.
3. **Cierra la app del todo** (deslizar en multitarea, no solo minimizar) y vuelve a abrirla.
   La segunda vez no debe crear una sesión nueva: se reutiliza la guardada.
4. Comprobación de que la sesión persiste de verdad, en el panel de Supabase:
   **Authentication → Users**. Cuenta los usuarios anónimos, reinicia la app dos o tres veces
   y vuelve a contar. El número no debe subir.
5. Modo avión antes de abrir la app por primera vez tras instalar: debe salir la pantalla de
   error con reintento, no una pantalla en blanco.

### Verificado

- `eslint`: 0 errores
- `tsc --noEmit`: limpio
- `jest --coverage`: 18 tests, 94.44% en dominio y datos (umbral 70%)
- `npx expo export --platform android`: compila, bundle 5.2 MB
- **En el Android real (2026-07-19):** la app arranca, muestra la landing, y tras varios
  cierres completos y reaperturas `npm run users` sigue devolviendo el mismo usuario
  (`73f3376a…`, creado 14:08:24 UTC). Cero usuarios nuevos, o sea que la sesión se reutiliza
  desde AsyncStorage en vez de recrearse.

Esta es además la primera vez que la app habla con Supabase de verdad, lo que cierra el matiz
que quedó abierto al final de la Fase 0.

---

## Incremento 2 · Crear y unirse a comunidad

### Backend (hecho)

Dos migraciones: `20260719150000_join_rate_limit.sql` y
`20260719151500_fix_join_community_ambiguity.sql`.

**Rate limit:** tabla `join_attempts` con RLS activo y sin políticas, o sea que solo la
alcanza la función `security definer`. El límite son **10 intentos fallidos en 15 minutos por
`auth.uid()`**. Cierra el punto E de la auditoría §11, que quedó pendiente en Fase 0.

#### `join_community` deja de lanzar excepciones

Cambia el contrato: antes devolvía `uuid` y lanzaba `invalid_join_code` o `username_taken`;
ahora devuelve `(status, community_id)` con `ok`, `invalid_join_code`, `username_taken` o
`too_many_attempts`.

No es estilo, es que la versión con excepciones **hacía imposible el rate limit**. En Postgres,
una excepción deshace la transacción entera, incluido el `insert` en `join_attempts` que
registra el intento. Cada intento fallido se borraba a sí mismo al fallar, así que el contador
nunca subía: un candado sin pestillo. Se detectó al escribir el test, no en producción.

Esto supera la descripción de `join_community` que da
[ADR-0002](../adr/ADR-0002-modelo-de-sesion-y-rls.md) (dice que "devuelve solo el
`community_id`"). El modelo de sesión y el razonamiento de RLS del ADR siguen vigentes; lo que
cambia es la forma del retorno.

#### La trampa de `#variable_conflict use_column`

La primera versión aplicada fallaba con `column reference "community_id" is ambiguous`
(SQLSTATE 42702): el parámetro de salida se llama `community_id` y `members` tiene una columna
igual, así que PL/pgSQL no sabe a cuál te refieres en el `insert` ni en el `on conflict`. Se
arregla con `#variable_conflict use_column` al principio del cuerpo.

Como la migración anterior ya estaba aplicada, **no se editó**: se añadió otra encima, que es
la regla de `supabase-data`.

#### Verificado

`npm run test:rls` pasa **13/13**, dos comprobaciones más que antes:

```
OK   El rate limit corta los intentos a fuerza bruta — cortado en el intento 10
OK   El rate limit es por usuario, no global — ok
```

La segunda importa: un rate limit mal escrito (contando intentos globales en vez de por
usuario) habría bloqueado a toda la beta en cuanto alguien se equivocara diez veces de código.

`db.types.ts` regenerado tras el cambio de firma.

### App (hecho)

Segunda feature completa, `community`, con la misma forma que `session`:

```
src/features/community/
├── domain/
│   ├── community.ts              Community + Membership
│   ├── join-code.ts              normalizar y validar el código
│   ├── names.ts                  normalizar y validar nombres
│   ├── community-repository.ts   el puerto
│   ├── create-community.ts       caso de uso
│   └── join-community.ts         caso de uso
├── data/
│   └── supabase-community-repository.ts
└── presentation/
    ├── active-community-store.ts     Zustand + persist (AsyncStorage)
    ├── use-create-community.ts       mutación
    ├── use-join-community.ts         mutación
    ├── use-go-to-list.ts             navegación al entrar en una lista
    ├── CreateCommunityScreen.tsx
    └── JoinCommunityScreen.tsx
```

Rutas nuevas: `src/app/create.tsx`, `src/app/join.tsx` y `src/app/list.tsx`. En `shared/`:
`ui/Input.tsx`, `ui/SnackbarHost.tsx` y `hooks/use-snackbar.ts`.

### Cómo se comporta la app al abrir

Lo que decidiste por las dos preguntas de diseño:

```
Abrir app
└─ ¿hay comunidad guardada en el dispositivo?
   ├─ sí → /list directo, sin pasar por la landing
   └─ no → landing (crear / tengo un código)
```

**Una sola comunidad por persona en la beta.** El store guarda una `Membership`, no una lista.
Crear o entrar en otra sustituye a la anterior en este móvil; la fila de `members` de la
anterior sigue en la base de datos, así que volver a entrar con el mismo código y el mismo
nombre te devuelve donde estabas. Soportar varias a la vez pide un selector de lista y un
`community_id` en cada query, y eso es una decisión de después de la beta.

### Decisiones sobre la marcha

**Los casos de uso devuelven estados, no lanzan.** Igual que la RPC del backend. Un código
equivocado o un nombre cogido son respuestas normales de un formulario, no averías, y con una
unión discriminada la pantalla puede poner el error **debajo del campo que lo causó** en vez
de en un aviso genérico. Las excepciones quedan para lo imprevisto (red caída, contrato roto).

**El código de invitación se valida en el móvil antes de llamar al servidor.** Un código a
medias no llega a `join_community`, así que un error de tecleo no gasta uno de los 10 intentos
del rate limit. No se pierde seguridad: un atacante mandaría códigos bien formados de todas
formas.

**Al escribir, los caracteres imposibles se descartan solos.** El alfabeto de `join_code` no
tiene `O`, `0`, `I` ni `1`, así que teclearlos no hace nada, igual que un campo numérico
ignora las letras. La alternativa era aceptarlos y fallar después, lo que manda al servidor un
código que no puede existir y encima gasta un intento.

**Al entrar con código, el adaptador lee la comunidad después de la RPC.** `join_community`
solo devuelve `community_id`, pero la pantalla necesita el nombre y el código para enseñarlos.
Es una segunda consulta, y a cambio crear y entrar devuelven exactamente la misma
`Membership`: la UI no tiene dos caminos que mantener. La lectura funciona porque después de
la RPC ya eres miembro y `communities_select` te deja.

**Un `status` desconocido del backend lanza.** Si mañana una migración añade un estado nuevo
y el adaptador lo dejara pasar, la app diría que entraste en una lista en la que no estás.
Mejor un error ruidoso.

**Crear y entrar no son mutaciones optimistas.** `CLAUDE.md` pide optimista con rollback en
toda mutación; esta es la excepción y queda anotada aquí. El `join_code` lo genera Postgres:
no hay forma de pintarlo por adelantado, y enseñar uno inventado que cambia medio segundo
después es peor que esperar. El botón se queda en carga.

**El cliente es más estricto que la base de datos con las longitudes.** El esquema sí tiene
`check` (`members.username` 1–40, `communities.name` 1–60), así que la BD no acepta cualquier
cosa; lo que pasa es que el cliente aprieta más (usuario 2–20, lista 2–40) y exige un mínimo de
2 que la BD no exige. La parte que solo vive en el cliente (el mínimo de 2 y los máximos más
cortos) no es validación de verdad. Va a deuda: alinear los `check` con los límites del
cliente en una migración.

**El atrás de Android obligó a vaciar la pila.** Con `router.replace('/list')` la pila quedaba
`[index, list]`, y como `index` redirige a `/list` cuando hay comunidad guardada, el botón
atrás entraba en bucle y el usuario no podía salir de la app. Se resuelve con
`router.canDismiss()` + `dismissAll()` antes del `replace`, en `use-go-to-list.ts`.

**El snackbar es uno solo, en el layout raíz.** El estado en `shared/hooks/use-snackbar.ts` y
el componente de Paper en `shared/ui/SnackbarHost.tsx`, separados para que el único import de
`react-native-paper` siga dentro de `shared/ui` como manda
[ADR-0004](../adr/ADR-0004-libreria-de-ui.md). Montarlo por pantalla haría que el aviso
desapareciera al navegar, justo cuando el usuario va a leerlo.

**"Salir de esta lista" solo borra el estado local.** No borra la fila de `members`. Está para
poder probar el flujo de entrar con código varias veces en el mismo móvil sin tener que
reinstalar; el nombre en la pantalla dice "salir", que es lo que el usuario percibe.

**`Button` gana `loading`.** Muestra un indicador y marca `accessibilityState.busy`. Un botón
que solo se deshabilita mientras hay red en vuelo no le dice a nadie que está pasando algo.

### La trampa de las rutas tipadas

Tras crear `create.tsx`, `join.tsx` y `list.tsx`, `tsc` fallaba con
`Type '"/list"' is not assignable to type RelativePathString | ...`. El fichero
`.expo/types/router.d.ts` lo genera el **dev server**, no `expo export`, así que seguía
listando solo `/` y `/_sitemap`. Se arregla arrancando `npx expo start` una vez. Anotado en
la skill `expo-stack` porque el error no apunta a nada roto y se pierde el rato buscándolo.

### Cómo probarlo

En el Android real, con `npx expo start --clear`:

1. **Crear.** Landing → "Crear una lista" → nombre `Casa` y tu nombre → "Crear la lista".
   Debe llevarte a la lista y enseñar un código tipo `PAN-42XK`.
2. **Persistencia.** Cierra la app del todo y ábrela: entra directo a la lista, sin landing.
3. **Atrás.** Con la lista abierta, botón atrás del sistema. Debe salir de la app, no volver
   a la landing ni quedarse pillado.
4. **Entrar con código.** "Salir de esta lista" → "Tengo un código" → mete el código del paso 1
   con **otro** nombre. Debe entrar en la misma lista.
5. **Nombre cogido.** Necesita **dos móviles**: desde el segundo, entra con el código y con el
   nombre que ya usa el primero. Error debajo del campo del nombre, no un aviso genérico.
   En un solo móvil esto no se puede reproducir, ver abajo.
6. **Código malo.** Mete `ZZZ-9999`. Error debajo del campo del código.
7. **Caracteres imposibles.** Intenta teclear `O`, `0`, `I` o `1` en el código: no aparecen.
8. **Sin red.** Modo avión y dale a crear: snackbar de conexión **al instante**, y el
   formulario sigue con lo que habías escrito.

### Lo que salió de probarlo en el Android

Pasos 1, 2, 3, 4, 6 y 7: correctos a la primera. El atrás del sistema sale de la app, que era
lo que más miedo daba.

**El paso 5 estaba mal planteado por mi parte.** En un solo móvil el `username_taken` no se
puede reproducir. La RPC hace `on conflict (community_id, auth_user_id) do update set
username`, y tu móvil es siempre el mismo `auth_user_id`: solo existe **una fila** de miembro
tuya en esa lista, así que al reentrar con otro nombre te actualizas a ti mismo en vez de
chocar con nadie. El choque contra `unique (community_id, username)` necesita que el nombre lo
tenga **otra persona**, o sea otro dispositivo. El camino sí está cubierto por la comprobación
*"Un username ya usado da username_taken"* de `npm run test:rls`, que abre dos sesiones
anónimas de verdad; lo que sigue sin probarse a mano es que la pantalla lo pinte en el campo
correcto.

**El paso 8 destapó un agujero real:** en modo avión la app se quedaba cargando para siempre y
la lista se creaba sola al recuperar la conexión. Android no rechaza la petición, la deja en
cola y la suelta al reconectar. Sin error no hay `onError`, y sin `onError` no hay snackbar.

Peor que el spinner eterno era lo otro: la lista **se creaba sin que el usuario se enterara**.
Si mientras tanto había cerrado la app o insistido, acababa con listas duplicadas.

#### Cómo se arregló

Dos piezas, porque ninguna cubre sola los dos casos:

**1. NetInfo antes de cada llamada** (`assertOnline()` en `src/shared/lib/network.ts`, llamado
al principio de cada método de los adaptadores). Si el dispositivo se sabe desconectado, lanza
`OfflineError` sin tocar la red y el aviso sale al instante.

Va en `data/` y no en los hooks a propósito: `data/` es el sitio por el que pasan todas las
llamadas de red, presentes y futuras. En los hooks de mutación se puede olvidar al escribir el
siguiente.

La comprobación es `state.isConnected === false`, no `!state.isConnected`. NetInfo devuelve
`null` cuando todavía no lo sabe, y bloquear al usuario por un "no lo sé" es peor que dejarle
intentarlo.

**2. Timeout de 12 s en el cliente de Supabase** (`fetchWithTimeout`, pasado como
`global.fetch` al `createClient`). Es la red de seguridad para el caso que NetInfo no ve:
wifi conectado pero sin salida a internet, o servidor que no responde. Ahí NetInfo dice que sí
hay red y solo el timeout evita el spinner eterno.

Se usa `AbortController` + `setTimeout` en vez de `AbortSignal.timeout()`, que no está
garantizado en el polyfill de fetch de React Native. El `signal` que traiga la petición
original se reenvía al controlador para no romper las cancelaciones de supabase-js.

Los dos mensajes son distintos porque son problemas distintos: `errors.offline` ("no tienes
conexión") cuando el móvil lo sabe, `errors.network` ("no se pudo conectar") cuando lo que
falla es el otro lado.

#### Lo que esto no arregla

**`create_community` no es idempotente.** Si la petición llegó al servidor y se cortó la
respuesta, reintentar crea dos listas. El timeout hace ese caso más probable, no menos: antes
la petición se quedaba colgada y acababa llegando. Resolverlo pide una clave de idempotencia
que el cliente genere y la RPC respete, y encaja con la cola de mutaciones offline de la
Fase 2, no aquí. Queda escrito para no redescubrirlo entonces.

### Verificado

- `eslint`: 0 errores
- `tsc --noEmit`: limpio
- `jest`: 53 tests, 94% largo en dominio y datos (umbral 70%)
- `npx expo export --platform android`: compila, bundle 5.27 MB
- `npm run test:rls`: 13/13
- **En el Android real (2026-07-20):** confirmado por el usuario. El 8 (modo avión) ahora
  avisa al instante y ya no crea la lista a escondidas; el resto de pasos, correctos. El
  camino de UI del 5 (`username_taken`) también queda cubierto por `npm run test:rls`.

### Deuda que se asume aquí

- **Los `check` de longitud de la base de datos son más laxos que los del cliente.**
  `members.username` acepta 1–40 y `communities.name` 1–60 en la BD, pero el cliente exige
  usuario 2–20 y lista 2–40. El mínimo de 2 y los máximos cortos solo los aplica la app. Toca
  alinear los `check` con esos límites en una migración. (Antes esta nota decía que no había
  `check` en la BD; era falso, corregido el 2026-07-20.)
- **No hay forma de cambiarse el nombre** una vez dentro de una lista. `join_community` hace
  `on conflict do update set username`, así que volver a entrar con el mismo código y otro
  nombre lo cambia; no hay pantalla para eso.
- **Una comunidad por dispositivo.** Decidido para la beta, no es un descuido. Ver arriba.
- **`create_community` no es idempotente.** Ver arriba: un reintento tras una respuesta
  perdida crea dos listas. Va con la cola de mutaciones offline de la Fase 2.
- **`username_taken` no está probado en la UI**, solo en el backend vía `npm run test:rls`.
  Hace falta un segundo dispositivo.

---

## Incremento 3 · Lista de artículos: leer y añadir

### Backend (nada que hacer)

Estaba todo desde la Fase 0: la tabla `items`, las cuatro políticas RLS
(`items_select`, `items_insert`, `items_update`, `items_delete`) y la función
`current_member_id`. Realtime es de la Fase 2. Así que este incremento es **100% cliente y de
un solo dispositivo**: TanStack Query contra Supabase, sin migraciones.

### App (hecho)

Tercera feature completa, `items`, con la misma forma que `session` y `community`:

```
src/features/items/
├── domain/
│   ├── item.ts               entidad Item (sin acoplar a db.types)
│   ├── item-name.ts          normalizar y validar el nombre (1–120)
│   ├── item-repository.ts    el puerto: list(communityId), add({communityId, name})
│   ├── add-item.ts           caso de uso: valida/normaliza → {status} discriminado
│   └── list-items.ts         caso de uso fino (delega al puerto)
├── data/
│   └── supabase-item-repository.ts
└── presentation/
    ├── use-items.ts          useQuery(['items', communityId]) + la clave en un solo sitio
    ├── use-add-item.ts       mutación OPTIMISTA con rollback
    ├── ItemsScreen.tsx
    └── components/
        ├── ItemRow.tsx
        └── AddItemBar.tsx
```

`src/app/list.tsx` deja de tener la pantalla dentro y pasa a re-exportar `ItemsScreen`, igual
que `create.tsx` y `join.tsx`. En i18n entran las claves `items.*` y desaparece
`list.comingSoon`.

### Decisiones sobre la marcha

**El alta SÍ es optimista.** Es la primera vez que se aplica la regla dura de `CLAUDE.md`. La
excepción de `create_community` (el servidor genera el `join_code`) no aplica aquí: el nombre
lo escribe el usuario, así que se puede pintar la fila al instante con un id temporal
(`optimistic-<timestamp>`) y reconciliar con la respuesta. `onMutate` mete la fila arriba,
`onError` la quita y avisa, `onSuccess` invalida para traer el id real. La receta detallada
está en la skill `expo-stack`.

**Se invalida en `onSuccess`, no en `onSettled`.** Con red no cambia nada; sin red sí. Como el
adaptador empieza por `assertOnline()`, un alta sin conexión lanza `OfflineError`, `onError`
ya restaura la caché y no queda nada que reconciliar. Invalidar en `onSettled` dispararía un
refetch que vuelve a chocar con `assertOnline()`: la query se quedaría marcada `isError` justo
después de un alta fallida, y con la lista vacía la pantalla enseñaría "no se pudo cargar" en
vez del estado vacío normal. En `onSuccess` solo reconcilia cuando de verdad hay algo nuevo.

**`created_by` va a `null`.** El cliente no tiene el id de miembro: ni `create_community` ni
`join_community` lo devuelven, y el store solo guarda comunidad + nombre. La política de
insert (`created_by is null or created_by = current_member_id(...)`) permite `null` a
propósito. Registrar quién añadió cada cosa pediría una llamada extra a `current_member_id` en
cada alta o guardar el member id en la `Membership`, y la atribución no se enseña hasta la
presencia de la Fase 2. Va a deuda.

**La lista se ordena por `created_at` descendente.** Lo recién añadido aparece arriba del todo,
justo debajo de la barra de añadir, sin tener que hacer scroll. Por eso la inserción optimista
también va al principio del array (`[optimistic, ...current]`), no al final: si no, la fila
nueva saltaría abajo y volvería arriba al reconciliar.

**El alta es solo nombre; la cantidad se queda en el `default 1` de la BD.** El selector de
cantidad (+/−) es del incremento 4 junto con RF-4. `ItemRow` ya enseña un `×N` cuando la
cantidad es mayor que 1, así que cuando llegue el selector no hay que tocar la fila.

**Lista plana, sin secciones pendientes/comprados todavía.** Marcar comprado es del incremento
4; hasta entonces todo está pendiente y una sola `FlatList` sobra. Se usa `FlatList`
(virtualizada) desde ya por el requisito no funcional de 200 ítems fluidos.

**La pantalla cruza features a propósito.** `ItemsScreen` vive en `items/` pero lee la comunidad
activa del store de `community/`. Eso es estado de cliente compartido (el "contexto actual" del
dispositivo), no la capa de datos de `community`, así que entra dentro de las reglas: la regla
dura es no importar Supabase/React en `domain/` y no duplicar server state, no que una feature
no pueda leer el estado de cliente de otra.

**El guard de sesión va antes que los hooks de datos.** `ItemsScreen` solo lee la `Membership`
y, si no hay, redirige a `/`. La lista real vive en un `ItemsView` interno que recibe la
comunidad por props y ahí sí llama a `useItems`/`useAddItem`. Partirlo así evita llamar hooks
después de un `return` condicional, que rompe las reglas de hooks de React.

**`assertOnline()` también en la lectura.** Sin red, la query falla limpio en vez de colgarse.
La caché offline persistida (TanStack persist + MMKV) es de la Fase 4; hasta entonces, sin red
y sin datos cacheados la pantalla enseña el estado de error con "Reintentar".

### Cómo probarlo

En el Android real, con `npx expo start`:

1. **Lista vacía.** Entra en tu lista: debe salir el estado vacío ("La lista está vacía…"), no
   una pantalla en blanco ni un spinner colgado.
2. **Añadir.** Escribe `Leche` y dale a "Añadir". Aparece **al instante** arriba del todo y el
   campo se vacía para seguir escribiendo. Añade dos o tres más.
3. **Persistencia real.** Cierra la app del todo y ábrela: los artículos siguen ahí (vienen de
   Supabase, no de caché local todavía).
4. **Botón desactivado.** Con el campo vacío o solo con espacios, el botón "Añadir" está
   apagado y no hace nada.
5. **Sin red.** Modo avión y dale a añadir: la fila **no** se queda puesta (se pinta y se
   revierte) y sale el snackbar de "no tienes conexión". Al quitar el modo avión, añadir vuelve
   a funcionar.
6. **Segundo dispositivo (si tienes otro).** Añade desde el móvil A; en el B **no** aparece
   solo: hay que salir y volver a entrar en la lista para verlo. El tiempo real es de la Fase 2,
   aquí la lista se refresca al abrir o al reintentar.

### Verificado

- `eslint`: 0 errores
- `tsc --noEmit`: limpio
- `jest`: 69 tests (16 nuevos: dominio de `items` + adaptador, incluido el caso sin conexión)
- `npx expo export --platform android`: compila, bundle 5.28 MB
- **En el Android real (2026-07-20):** confirmado por el usuario. Añadir pinta la fila al
  instante, persiste tras cerrar la app, y sin red la fila se revierte con aviso.

### Deuda que se asume aquí

- **`created_by` no se registra.** Todas las altas van con `created_by = null` hasta que el
  cliente tenga el id de miembro. Se resuelve cuando llegue la atribución/presencia (Fase 2).
- **Sin caché offline.** Sin red y sin datos ya cargados, la lista no se puede ver: enseña
  error con reintento. La persistencia local es de la Fase 4.
- **El alta optimista no reintenta sola.** Si falla, se revierte y hay que volver a darle. La
  cola que reintenta al reconectar es de la Fase 4; hasta entonces el mensaje de error no
  promete un reintento que no existe.

---

## Incremento 4 · Marcar comprado y borrar con deshacer

### Backend (nada que hacer)

Igual que el 3: `items_update` e `items_delete` ya existían desde la Fase 0, y `quantity >= 1`
lo valida un `check` de la tabla. Sin migraciones.

Un detalle del esquema que cambia cómo se escribe desde el cliente: hay un trigger
`items_touch_updated_at` que pone `updated_at = now()` en cada `update`. El cliente **no manda**
`updated_at`; lo dueño es la base de datos. Importa para el last-write-wins de la Fase 4, que se
apoyará en esa columna.

### App (hecho)

Sobre la feature `items` del incremento 3 se añaden tres operaciones y la cantidad:

```
src/features/items/
├── domain/
│   ├── quantity.ts           minQuantity + isValidQuantity (entero ≥ 1)
│   ├── add-item.ts           ahora acepta y valida la cantidad
│   ├── set-purchased.ts      caso de uso
│   ├── delete-item.ts        caso de uso
│   └── item-repository.ts    el puerto gana setPurchased y remove
├── data/
│   └── supabase-item-repository.ts   + update (marcar) y delete (borrar)
└── presentation/
    ├── use-toggle-purchased.ts   mutación optimista
    ├── use-delete-item.ts        borrado con ventana de deshacer
    ├── use-add-item.ts           pasa la cantidad
    ├── ItemsScreen.tsx           SectionList con dos secciones
    └── components/
        ├── ItemRow.tsx           checkbox + tachado + botón de borrar
        └── AddItemBar.tsx        + selector de cantidad
```

En `shared/ui`, dos componentes propios nuevos: `Checkbox.tsx` y `QuantityStepper.tsx`. Se
hacen a mano (glifos `✓` y `−/+`) en vez de tirar de Paper, que por
[ADR-0004](../adr/ADR-0004-libreria-de-ui.md) solo vale para `Snackbar`, `Dialog` y `Portal`.

### Decisiones sobre la marcha

**Borrar es diferido, con ventana de deshacer (estilo Gmail).** Al pulsar la ✕, la fila
desaparece de la lista al instante y sale un snackbar "Deshacer" durante 5 s; el `delete`
contra el servidor **se dispara al cerrarse esa ventana**, no antes. Si el usuario deshace,
se cancela el `setTimeout` y se restaura la caché desde el snapshot: la fila nunca se borró.
La alternativa (borrar ya y que deshacer re-inserte) crea una fila nueva con otro `id` y otra
fecha, o sea que "deshacer" no devolvería el artículo original. El coste es que el borrado no
es una `useMutation` normal, sino un `useCallback` que orquesta el timer y el snackbar.

**El timer sobrevive a salir de la pantalla.** Si cierras la lista dentro de esos 5 s, el
borrado se confirma igual: es una promesa suelta con `queryClient` (que es de app), no estado
de componente, así que no hay `setState` tras desmontar. Es lo que se espera: borraste, te
fuiste, se borró.

**Si el `delete` diferido falla, se re-mete el artículo, no se restaura el snapshot.** Un
`delete` que falla significa que la fila sigue en el servidor, así que la verdad es que el
artículo existe: se vuelve a meter en la caché (arriba) y sale un aviso. Restaurar el snapshot
entero pisaría cualquier cambio hecho en esos 5 s.

**Marcar comprado es optimista**, con el patrón de la skill: `onMutate` cambia el flag,
`onError` revierte con aviso, `onSuccess` invalida. Igual que el alta, invalida en `onSuccess`
y no en `onSettled`, por lo mismo del offline (ver incremento 3).

**Dos secciones con `SectionList`: "Por comprar" y "Comprados".** Una sección solo aparece si
tiene artículos, así que una lista sin comprados no enseña una cabecera "Comprados" vacía. El
orden dentro de cada sección es el de la query (fecha descendente), no se reordena en cliente.

**El estado "comprado" no depende solo del color.** La fila comprada lleva el check marcado
(glifo, no solo relleno), el nombre **tachado** y encima está bajo la cabecera "Comprados".
Tres señales además del color, que es lo que pide la regla de accesibilidad.

**La cantidad, solo en el alta.** El selector −/N/+ va en la barra de añadir (RF-4 pide +/−),
con mínimo 1 y por defecto 1. Editar la cantidad de un artículo ya creado se deja fuera a
propósito: llenaría la fila de controles y editar es más bien RF-3 "modificaciones". `ItemRow`
ya pinta un `×N` cuando la cantidad es mayor que 1, así que cuando llegue la edición no hay que
tocar la fila. Queda en deuda.

**El borrado no está cubierto por tests de máquina.** El temporizador y la ventana de deshacer
son lógica de presentación (un `useCallback` con `setTimeout`), y la convención del proyecto es
cubrir dominio y datos, no la UI. Se verifica a mano (pasos de abajo). Dominio y adaptador del
resto sí están cubiertos.

### Cómo probarlo

En el Android real, con `npx expo start`:

1. **Marcar comprado.** Toca el checkbox de un artículo: se tacha y baja a "Comprados" al
   instante. Vuelve a tocarlo: sube a "Por comprar".
2. **Persistencia del estado.** Marca un par, cierra la app del todo y ábrela: siguen como los
   dejaste.
3. **Cantidad al añadir.** Sube la cantidad con el +, añade: la fila muestra `×N`. Con cantidad
   1 no muestra nada. El − no baja de 1.
4. **Borrar con deshacer.** Dale a la ✕: la fila desaparece y sale "…​borrado" con "Deshacer".
   Púlsalo antes de 5 s: la fila vuelve. Compruébalo también dejando pasar los 5 s: se va de
   verdad (ciérrala y ábrela, no está).
5. **Sin red al marcar/borrar.** Modo avión: marcar revierte con aviso; borrar, como espera los
   5 s, cuando el timer dispara el `delete` sin red vuelve a meter la fila y avisa.
6. **Accesibilidad rápida.** Con TalkBack, el checkbox se anuncia como casilla con su estado, y
   la ✕ como "Borrar <nombre>".

### Verificado

- `eslint`: 0 errores
- `tsc --noEmit`: limpio
- `jest`: 79 tests (10 nuevos: cantidad, `set-purchased`, `delete-item`, y `add`/`setPurchased`/
  `remove`/offline del adaptador)
- `npx expo export --platform android`: compila, bundle 5.3 MB
- **En el APK (2026-08-02):** confirmado por el usuario. Marcar/desmarcar, cantidad al añadir y
  el borrado con deshacer (dentro y fuera de los 5 s) funcionan.

### Deuda que se asume aquí

- **No se puede editar un artículo ya creado** (ni nombre ni cantidad). Solo marcar, borrar y
  crear con cantidad. La edición es RF-3 "modificaciones" y va después.
- **El borrado diferido no se prueba en máquina**, solo a mano. Ver arriba.
- **El borrado no se encola si estás sin red**: si el timer dispara sin conexión, la fila
  vuelve y avisa, pero no reintenta al reconectar. Va con la cola de la Fase 4.

---

## Incremento 5 · Estados vacíos, errores y repaso de accesibilidad

El cierre de la fase. Las pantallas de los incrementos 3 y 4 ya traían vacío, error de carga y
las etiquetas de accesibilidad, así que esto fue sobre todo un repaso y tapar los huecos que
quedaban en la lista. Nada de código nuevo en `domain/` ni `data/`: todo es presentación.

Cambios en `ItemsScreen`:

- **Indicador de carga.** Mientras carga la lista por primera vez ahora sale un spinner
  (`ActivityIndicator`) con etiqueta para el lector de pantalla, en vez del hueco en blanco de
  antes.
- **El error de carga distingue el "sin conexión".** Si la query falla por `OfflineError`, el
  mensaje dice que no hay conexión; en cualquier otro caso, el genérico. Antes salía siempre el
  genérico aunque el problema fuera obvio (modo avión).
- **Tirar para refrescar** (`RefreshControl`) enganchado a `refetch`.
- **Cabeceras de sección como `header`** para que TalkBack salte entre "Por comprar" y
  "Comprados".
- Se muestra el **hint del código de invitación** debajo del código. La cadena
  (`list.joinCodeHint`) ya existía traducida pero no se pintaba en ninguna parte.

### Decisiones sobre la marcha

**Tirar para refrescar es el puente hasta la Fase 2.** La sincronización en vivo (Realtime) es
de la Fase 2. Hasta entonces, un cliente no se entera de lo que añaden los demás salvo que
reinicie la query, así que en una lista compartida por varias personas la lista se quedaría
quieta. El `RefreshControl` da esa recarga manual con un gesto estándar que el usuario ya
conoce. Es barato y se queda cuando llegue Realtime (uno no quita el otro). Cuando esté
Realtime, refrescar a mano pasa a ser el respaldo para cuando el canal se cae.

**El estado "sin conexión" reutiliza `errors.offline`, no un mensaje nuevo.** Es el mismo texto
que ya usan el alta y el marcado, así que el usuario ve siempre la misma frase para el mismo
problema. Se distingue mirando si el `error` de la query es `OfflineError`, que es lo que lanza
`assertOnline()` en el adaptador.

**El repaso de accesibilidad casi no tocó código porque ya estaba hecho.** Se revisó componente
por componente y todos cumplían: `Button`, `Input`, `Checkbox`, `QuantityStepper` y la fila y el
botón de borrar de `ItemRow` llevan `minTouchTarget` (44 pt), su `accessibilityRole`, su
`accessibilityState` donde aplica y etiqueta. Los errores de formulario ya salían con
`accessibilityLiveRegion="polite"`. Lo único que faltaba en la lista eran las tres cosas de
arriba (spinner con etiqueta, cabeceras como `header`, mensaje de error como *live region*).

### Repaso de accesibilidad (lo que se comprobó)

Verificable en el código, ya cumplido:

- Etiqueta + rol en cada control; `accessibilityState` en checkbox (`checked`), botones
  (`disabled`, `busy`) y stepper (`disabled`).
- Área táctil ≥ 44 pt en todo lo pulsable (`minTouchTarget`, más `hitSlop` en checkbox y borrar).
- El estado "comprado" no depende solo del color: check + tachado + sección.
- Modo claro/oscuro salido de los tokens (`dark:` en todas las clases).
- Textos sin `maxFontSizeMultiplier`, así que respetan el tamaño de fuente del sistema.

Pendiente de comprobar en el dispositivo (no se puede desde el código): recorrido real con
TalkBack, medición de contraste AA sobre la pantalla y que con la fuente del sistema al máximo
no se rompa ningún layout.

### Cómo probarlo

Sobre el APK (o `npx expo start` mientras tanto):

1. **Carga.** Al abrir la lista se ve un momento el spinner antes de los artículos.
2. **Vacío.** Una lista sin artículos enseña el texto de lista vacía, no un hueco.
3. **Error offline.** Modo avión y entra en una comunidad cuya lista no esté cacheada: sale el
   mensaje de sin conexión con "Reintentar". Quita el modo avión y reintenta: carga.
4. **Refrescar.** Tira hacia abajo en la lista: aparece el indicador de recarga. (Con dos
   móviles: añade en uno, refresca en el otro y aparece.)
5. **Modo oscuro.** Cambia el tema del sistema: la app sigue legible y con contraste en los dos.
6. **Fuente grande.** Sube el tamaño de fuente del sistema al máximo: los textos crecen y nada
   queda cortado ni encajado.
7. **TalkBack.** Enciéndelo: las cabeceras "Por comprar"/"Comprados" son navegables como títulos
   y el spinner de carga se anuncia.

### Verificado

- `eslint`: 0 errores
- `tsc --noEmit`: limpio
- `jest`: 79 tests (sin tests nuevos: los cambios son de presentación, que por convención no se
  cubre con tests unitarios; dominio y datos siguen cubiertos)
- `npx expo export --platform android`: compila, bundle 5.3 MB
- **En el APK (2026-08-02):** confirmado por el usuario. Carga, vacío, error offline, tirar
  para refrescar y modo claro/oscuro correctos. Queda pendiente solo el repaso fino de a11y en
  dispositivo (TalkBack, medición de contraste, fuente al máximo).

### Deuda que se asume aquí

- **El contraste AA no está medido, se confía en los tokens.** Los colores vienen del tema, que
  se eligió con la regla AA en mente, pero no se ha pasado un medidor sobre la pantalla real.
- **La fuente del sistema no tiene tope.** Si alguien la pone gigante, algún texto largo podría
  apretar. Se revisa en el dispositivo y, si molesta, se acota con `maxFontSizeMultiplier`.

---

## Despliegue (decidido durante la fase)

Para tener la beta instalada de verdad, no atada al QR de Expo Go, se añadió `eas.json` en la
raíz (perfiles `development`, `preview` y `production`) y la guía
[despliegue](../guias/despliegue.md). El resumen:

- **Backend gratis.** No hay servidor propio que desplegar; todo el lado servidor es Supabase.
  El plan Free sobra para la beta. Su única pega es que un proyecto Free **se pausa tras 7 días
  sin actividad**: al pausarse deja de resolver en DNS y la app arranca con `Network request
  failed`. Pasó en la primera prueba del APK (beta parada unos días); se recupera a mano con
  *Restore* en el panel. Para que no vuelva, se montó un **ping diario** como GitHub Action
  (`.github/workflows/keep-supabase-awake.yml`) que llama una vez al día a la RPC `public.ping()`
  (migración `20260802120000`), concedida a `anon` a propósito porque una lectura de tabla como
  anónimo choca con RLS (`member_community_ids` no es ejecutable por `anon`). No se paga Pro solo
  por esto.
- **App en el móvil.** Un APK del perfil `preview` (`distribution: internal`), que empaqueta el
  JS y arranca solo, sin Metro ni QR en ejecución. Se instala una vez y se reparte el mismo
  enlace a la beta. El proyecto de EAS quedó con `slug: agora` y `owner: alejes0407s-team`; el
  nombre visible de la app sigue siendo "Lista de la compra". El bucle de desarrollo diario
  sigue siendo Expo Go.
- **Actualizaciones OTA (EAS Update) montadas.** `expo-updates` instalado, `runtimeVersion` con
  `policy: appVersion` y `updates.url` en `app.json`. Los cambios de solo JS se publican con
  `eas update --branch preview` sin reconstruir; los cambios nativos siguen pidiendo APK nuevo.
- **Camino real vs. plan.** Las variables se subieron con `eas env:set` (el `env:create`
  interactivo está deprecado y tiene la trampa del multi-select), y a mitad se coló un
  `create-expo-app` por error que dejó una carpeta de andamiaje, ya borrada. Todo ello queda en
  la [guía de despliegue](../guias/despliegue.md).
