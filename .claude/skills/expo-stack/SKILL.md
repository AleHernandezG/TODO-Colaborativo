---
name: expo-stack
description: Convenciones del stack móvil de este proyecto — Expo Router, TanStack Query, Zustand, AsyncStorage, NetInfo y la arquitectura domain/data/presentation. Úsala SIEMPRE que vayas a crear o editar cualquier cosa dentro de src/ — pantallas, rutas, hooks, casos de uso, repositorios, stores o componentes de UI — y también cuando tengas que decidir dónde vive un estado, cómo escribir una mutación, cómo se propaga un cambio en tiempo real o cómo se comporta la app sin red. Aplica aunque el usuario solo diga "añade una pantalla", "haz un hook" o "guarda esto".
---

# Stack móvil: Expo + Query + Zustand

Esta app es una lista de la compra compartida por varias personas a la vez, posiblemente
en países distintos. Dos consecuencias que explican casi todas las reglas de abajo:

1. **La red va a fallar.** No es un caso raro, es el caso normal. Por eso cada mutación
   es optimista con rollback: el usuario nunca espera a un servidor que puede tardar 3s.
2. **Varias personas tocan el mismo dato.** Por eso el servidor es la única fuente de
   verdad y nunca se copia su estado a un store local, que se quedaría rancio.

## Frontera de imports

La regla de arquitectura más fácil de romper sin darse cuenta. Antes de añadir un import,
mira en qué capa estás:

| Capa            | Puede importar                                   | Nunca importa                                       |
| --------------- | ------------------------------------------------ | --------------------------------------------------- |
| `domain/`       | tipos propios, utilidades puras                  | React, Supabase, Query, Zustand, Expo, AsyncStorage |
| `data/`         | Supabase, tipos de `domain/`                     | React, Query, componentes                           |
| `presentation/` | React, Query, Zustand, `shared/ui`, casos de uso | `@supabase/*` directamente                          |
| `shared/ui/`    | React, RN, NativeWind, `theme/`                  | Query, Supabase, stores de feature                  |

`domain/` limpio no es purismo: es lo que permite testear `joinCommunity()` en milisegundos
sin arrancar React ni mockear red. Si necesitas Supabase dentro de `domain/`, es señal de que
esa lógica pertenece a `data/` o de que falta un puerto.

Comprobación rápida antes de cerrar una tarea:

```bash
grep -rE "from '(react|@supabase|@tanstack|zustand|expo)" src/features/*/domain/
```

Cero resultados o hay algo mal colocado.

### Un script de `scripts/` sí puede leer `domain/`, y así

Los scripts son `.mjs` de Node y `domain/` es TypeScript, así que la tentación es copiar la
función y seguir. No se copia: se importa con el borrado de tipos de Node.

```js
import { normalizeCatalogName } from '../src/features/catalog/domain/normalized-name.ts'
```

```json
"catalog:ingest": "node --env-file=.env --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/catalog-ingest.mjs"
```

La extensión `.ts` va explícita en el import, que es lo que Node exige. Los dos
`--disable-warning` son ruido, no funcionalidad: el segundo aparece porque este `package.json`
no es `"type": "module"` y no puede serlo, hay `jest.config.js` y `babel.config.js` en CommonJS.

**Condición para que esto se sostenga: el fichero compartido no importa nada.** Una función pura
de entrada a salida. En cuanto encadene imports, el borrado de tipos tiene que resolver módulos
y deja de ser el subconjunto estable de la característica.

Por qué importa que sea de verdad el mismo fichero: la normalización decide a la vez lo que se
guarda en `normalized_name` y lo que se busca desde el móvil. Dos copias que divergen no dan un
error, dan un usuario escribiendo «azúcar» y no encontrando nada.

## Puerto y adaptador

El dominio declara qué necesita; `data/` decide con qué lo cumple.

```ts
export interface ItemRepository {
  list(communityId: string): Promise<Item[]>
  add(input: NewItem): Promise<Item>
  setPurchased(id: string, purchased: boolean): Promise<Item>
  remove(id: string): Promise<void>
}
```

El adaptador Supabase implementa esa interfaz y traduce filas de Postgres (`snake_case`,
`is_purchased`) a entidades de dominio (`camelCase`, `isPurchased`). Esa traducción vive
en `data/`, no se filtra a la UI: si mañana cambias de backend, la UI no se entera.

### Lo que el usuario puede provocar es un estado, no una excepción

Un código de invitación equivocado o un nombre ya cogido no son fallos: son respuestas
previsibles. Los casos de uso las devuelven como unión discriminada y la pantalla decide qué
enseñar en cada campo.

```ts
export type JoinCommunityResult =
  | { status: 'ok'; membership: Membership }
  | { status: 'invalid_join_code' }
  | { status: 'username_taken' }
  | { status: 'too_many_attempts' }
  | { status: 'invalid_username' }
```

Las excepciones quedan para lo que no debería pasar nunca: se cayó la red, o el backend
devolvió algo que no encaja con el contrato. Esas suben al `onError` de la mutación y acaban
en un snackbar genérico.

Un estado que el adaptador no conoce **lanza**, no se ignora. Si una migración futura añade
`community_full` y el adaptador lo deja pasar en silencio, la app dirá que entraste en una
lista en la que no estás.

## Dónde vive cada estado

Pregúntate: **¿este dato podría cambiarlo otra persona desde su móvil?**

- Sí → TanStack Query. Artículos, miembros, comunidad.
- No → Zustand. Tema claro/oscuro, idioma, sesión local (`memberId`, `communityId`), estado
  de UI como "el modal está abierto".

Copiar la lista de artículos a un store de Zustand parece cómodo y rompe la app en cuanto
llega un evento Realtime: tendrías dos copias divergiendo. La caché de Query ya es un store
global, con invalidación y refetch incluidos.

### Stores persistidos: espera a la hidratación

El store de la comunidad activa usa `persist` sobre AsyncStorage, que es **asíncrono**. En el
primer render `membership` es `null` aunque el usuario lleve semanas dentro de una lista, así
que una redirección que mire ese valor sin más manda a la landing a alguien que ya tiene lista.

```ts
const [hydrated, setHydrated] = useState(() => store.persist.hasHydrated())

useEffect(() => {
  const unsubscribe = store.persist.onFinishHydration(() => setHydrated(true))
  if (store.persist.hasHydrated()) {
    setHydrated(true)
  }
  return unsubscribe
}, [])
```

Las dos comprobaciones hacen falta: si la hidratación termina entre el render y el efecto, el
evento ya pasó y suscribirse tarde te deja esperando para siempre. Un `hasHydrated()` dentro
del efecto cierra esa carrera.

## Mutaciones optimistas

Toda mutación sigue este patrón. El `cancelQueries` es el paso que se olvida: sin él, un
refetch en vuelo puede aterrizar después de tu escritura optimista y pisarla.

```ts
export function useTogglePurchased(communityId: string) {
  const queryClient = useQueryClient()
  const key = itemKeys.list(communityId)

  return useMutation({
    mutationFn: (item: Item) => itemRepository.setPurchased(item.id, !item.isPurchased),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Item[]>(key)
      queryClient.setQueryData<Item[]>(key, (items = []) =>
        items.map((i) => (i.id === item.id ? { ...i, isPurchased: !i.isPurchased } : i)),
      )
      return { previous }
    },
    onError: (error, _item, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      showSnackbar(
        error instanceof OfflineError ? t('errors.offline') : t('items.errors.addFailed'),
      )
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
```

El rollback sin aviso es peor que no hacer rollback: el artículo vuelve a su sitio solo y el
usuario cree que la app está poseída. Snackbar discreto, siempre, con texto vía i18n.

**Se invalida en `onSuccess`, no en `onSettled`.** El motivo es el offline. Como cada método
de `data/` empieza por `assertOnline()`, una mutación sin red revienta con `OfflineError`,
`onError` ya restaura la caché al snapshot de `onMutate`, y no queda nada que reconciliar.
Invalidar ahí lanzaría un refetch que también choca con `assertOnline()` y falla: la query
conserva sus datos pero se marca `isError`, y una pantalla que enseñe el estado de error con
la lista vacía acabaría diciendo "no se pudo cargar" justo después de un alta fallida. En
`onSuccess` solo reconcilias cuando de verdad hay algo nuevo del servidor (p. ej. sustituir
el id temporal del alta optimista por el real). El `cancelQueries` de `onMutate` sigue siendo
el que evita que un refetch en vuelo pise la escritura.

**El mensaje del `onError` distingue offline de lo demás**, igual que las pantallas de
`community`: `OfflineError` → `errors.offline`, cualquier otra cosa → el error propio de la
acción. Con la cola offline puesta, ese `OfflineError` es ya el caso raro: la mutación se pausa
antes de intentarlo, y solo llega ahí si la red se cayó entre la decisión y la petición.

`errors.syncFailed` sigue sin usarse aunque la cola exista, y no es un olvido: cuando un cambio
se encola no falla nada que anunciar (para eso está el banner de la cabecera), y cuando algo
falla de verdad es porque no se encoló. Prometer un reintento que no va a ocurrir es peor que
callarse.

**Cuándo no hay optimista.** Si el servidor genera el dato que la pantalla necesita, no hay
nada que pintar por adelantado: `create_community` devuelve un `join_code` que solo existe
en la base de datos, y enseñar uno inventado que luego cambia es peor que esperar. Esas
mutaciones muestran el botón en estado de carga y esperan. Es la excepción, no el patrón:
si dudas, es que la mutación sí puede ser optimista.

Las claves de query se declaran en un solo sitio por feature para que invalidar no sea
adivinar:

```ts
export const itemKeys = {
  all: ['items'] as const,
  list: (communityId: string) => [...itemKeys.all, communityId] as const,
}
```

## Borrar con deshacer

Borrar es la única acción destructiva de la app y el usuario objetivo es novato. En vez de
un diálogo de confirmación (fricción en la acción común para protegerse del caso raro), se
borra de la lista al instante y se ofrece "Deshacer" en el snackbar durante ~5s.

**El `delete` real se difiere: no se dispara hasta que se cierra la ventana de deshacer.** Por
eso el hook no devuelve una mutación, sino un `useCallback` que marca el artículo como "en
borrado", programa el `delete` con un `setTimeout` y enseña el snackbar. Si el usuario deshace,
cancelas el timer y quitas la marca; el servidor nunca se enteró.

Lo que se programa **sí es una mutación con clave**, para que sin cobertura se encole en vez de
fallar (ver "Sin cobertura no se falla: se encola"):

```ts
export function useDeleteItem(communityId: string) {
  const queryClient = useQueryClient()
  const showSnackbar = useSnackbar()
  const { t } = useTranslation()

  const mutation = useMutation<void, Error, ItemMutationVariables>({
    mutationKey: itemMutationKeys.remove,
    onSuccess: (_result, { item }) => {
      const key = itemKeys.list(communityId)
      queryClient.setQueryData<Item[]>(key, (cur = []) => cur.filter((i) => i.id !== item.id))
      queryClient.invalidateQueries({ queryKey: key })
    },
    onError: (error) => {
      showSnackbar(
        error instanceof OfflineError ? t('errors.offline') : t('items.errors.deleteFailed'),
      )
    },
    onSettled: (_result, _error, { item }) => {
      useDeletingItemsStore.getState().clearDeleting(item.id)
    },
  })

  const remove = mutation.mutate

  return useCallback(
    (item: Item) => {
      const { markDeleting, clearDeleting } = useDeletingItemsStore.getState()

      markDeleting(item.id)

      let undone = false
      const timer = setTimeout(() => {
        if (undone) return
        remove({ communityId, item })
      }, 5000)

      showSnackbar(t('items.deleted', { name: item.name }), {
        label: t('common.undo'),
        onPress: () => {
          undone = true
          clearTimeout(timer)
          clearDeleting(item.id)
        },
      })
    },
    [remove, showSnackbar, t, communityId],
  )
}
```

`clearDeleting` va en `onSettled`, y una mutación en pausa no ha terminado: sin red el artículo
se queda oculto mientras espera su turno en la cola, que es lo que el usuario espera de algo que
acaba de borrar.

Borrar dos artículos seguidos funciona aunque el hook tenga un solo observador: cada `mutate`
construye una `Mutation` propia en la caché, con sus variables y sus callbacks. Lo que se pierde
al llamar otra vez es el seguimiento (`isPending`, `variables`), que aquí no se usa.

Por qué diferir en vez de borrar ya y que "Deshacer" re-inserte: re-insertar crea una fila
nueva con otro `id` y otra fecha, así que "deshacer" no devolvería el artículo original.

Cuatro detalles que importan:

- **La fila se esconde marcándola, no quitándola de la caché.** La caché es el reflejo del
  servidor y el servidor todavía la tiene. Ver "Realtime contra el borrado con deshacer" más
  abajo: quitarla a mano hace que reaparezca sola en cuanto alguien más toque la lista.
- **El timer sobrevive a desmontar la pantalla.** Es una promesa suelta con `queryClient` (que
  es de app) y un store de módulo, no estado de componente. Si el usuario borra y se va, el
  borrado se confirma igual, que es lo que espera.
- **En el camino de éxito se quita la fila de la caché ANTES de desmarcarla.** `setQueryData`
  es síncrono y el `.finally()` corre después del `.then()`, así que no hay ningún instante en
  que la fila esté sin marca y todavía en la caché. Al revés, parpadea.
- **La clave (`itemKeys.list`) se recalcula dentro del callback** y las deps llevan
  `communityId`, no la clave: un array nuevo en cada render invalidaría el `useCallback` sin
  necesidad.

Si el `delete` diferido falla, no hay nada que restaurar: la fila sigue en la caché y quitarle
la marca la devuelve a la pantalla. Solo queda avisar por snackbar.

## Realtime

El `RefreshControl` (tirar para refrescar) enganchado al `refetch` de la query **no se quita**
ahora que hay Realtime: es el respaldo para cuando el canal se cae. Y el estado de error de la
**lectura** distingue `OfflineError` igual que las mutaciones: `errors.offline` si el móvil
sabe que no hay red, el mensaje de carga genérico en cualquier otro caso.

### La suscripción es un método del puerto, no un import de Supabase

Suscribirse es acceso a datos, así que va en el repositorio como cualquier otra lectura. Un
`supabase.channel(...)` dentro de `presentation/` rompe la tabla de fronteras de arriba y ata
la pantalla al proveedor.

```ts
export type ItemsChannelStatus = 'connecting' | 'connected' | 'disconnected'

export interface ItemRepository {
  // ...
  subscribe(
    communityId: string,
    handlers: {
      onChange: () => void
      onStatus: (status: ItemsChannelStatus) => void
    },
  ): () => void
}
```

Devuelve la función de baja en vez de una promesa: el que se suscribe es un `useEffect` y lo
que necesita es algo que llamar en el cleanup. El adaptador traduce los estados del canal
(`SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`) a los tres del dominio, igual que
traduce `is_purchased` a `isPurchased`.

**`subscribe()` es el único método de `data/` que NO empieza por `assertOnline()`.** La regla
existe porque una petición suelta sin red se queda colgada para siempre; un canal no es una
petición suelta, tiene su propio bucle de reconexión y ya informa de que está caído por
`onStatus`. Bloquear la suscripción porque NetInfo diga que no hay red significaría no
reconectar nunca cuando vuelva. Además `subscribe` es síncrono, así que no hay dónde esperar.

### El hook: invalidar, con dos temporizadores

```ts
const eventCoalesceMs = 300
const subscribeSettleMs = 1500
```

Invalidar y refetchear es más tosco que parchear la caché con el payload del evento, pero es
correcto por construcción y una lista de la compra tiene decenas de filas, no miles. Además el
payload de un `DELETE` trae solo el `id` (ver la skill `supabase-data`), así que parchear la
caché con datos del evento no es siquiera posible para los borrados.

Los dos retardos no son adorno:

- **`eventCoalesceMs`**: marcar cinco artículos seguidos son cinco eventos. Sin agrupar, cinco
  refetches. Cada evento reprograma el temporizador, así que la ráfaga acaba en una sola
  lectura.
- **`subscribeSettleMs`**: hay ~1s tras `SUBSCRIBED` en que el servidor todavía no tiene
  registrada la suscripción y **los eventos se pierden sin dejar rastro**. Por eso, al pasar a
  `connected`, se programa un refetch pasado ese margen. Lo que se haya perdido entra por la
  lectura normal. No es un caso de red mala: es el arranque normal de cualquier pantalla.

**No invalides con una mutación en vuelo.** Tu propio `insert` genera un evento que te llega a
ti también (comprobado en `npm run test:realtime`). Si ese evento invalida mientras el alta
optimista está a medias, el refetch aterriza con datos del servidor que aún no incluyen la
fila y el artículo parpadea. `queryClient.isMutating() > 0` → reprograma en vez de invalidar;
el `onSuccess` de la mutación ya invalida por su cuenta.

El `unsubscribe()` del cleanup no es opcional: sin él acumulas canales en cada remontaje y
acabas con eventos duplicados.

### Realtime contra el borrado con deshacer

Durante los 5 s de "Deshacer" la fila ya no se ve pero **sigue en el servidor**. Si en esa
ventana llega un evento de otra persona y se invalida, el refetch la trae de vuelta y el
artículo reaparece con el botón Deshacer todavía en pantalla.

Por eso el borrado diferido no toca la caché: marca el id en un store de ids en curso
(`useDeletingItemsStore`) y la query los filtra en su `select` con `visibleItems()`. La caché
es del servidor y refleja lo que el servidor tiene; lo que se esconde por decisión local es
estado de UI y vive en Zustand. Deshacer es quitar el id del store, sin restaurar nada.

Esto sustituye al patrón de la sección anterior, que restauraba un snapshot: el snapshot pisa
lo que otras personas hayan cambiado en esos 5 s, y con Realtime eso pasa de "poco probable" a
"lo normal".

### Recuperarse: tres caminos, y ninguno sobra

1. El canal reconecta solo y vuelve a `SUBSCRIBED`. El `onStatus` ya programa el refetch de
   `subscribeSettleMs`: reconectar y arrancar son el mismo caso, un canal que empieza a
   escuchar sin saber qué se perdió.
2. Volver a primer plano. Android congela los temporizadores en segundo plano y puede cerrar el
   socket sin avisar. `useAppForeground` (en `shared/hooks`) refresca al volver, que es justo
   cuando el usuario mira la pantalla. Se refresca con `eventCoalesceMs`, no con el retardo
   largo: volver de segundo plano no crea ninguna suscripción.
3. Tirar para refrescar. El único que controla el usuario, y el que le queda si fallan los dos.

**El camino 2 es `useAppForeground` en el hook que necesita el dato, no el `focusManager` de
Query.** Query trae su propio mecanismo de "refresca al recuperar el foco", pero en React Native
hay que engancharlo a `AppState` a mano y aquí está deliberadamente sin enganchar: activarlo
haría que la lista se refrescara dos veces al volver, una por cada mecanismo, y el de aquí es el
que sabe coalescer y esperar a que no haya mutaciones en vuelo. Cualquier query que necesite
enterarse al volver a primer plano (el `join_code`, por ejemplo, que puede haber rotado otro
móvil) lo pide igual, invalidándose desde su propio hook.

El aviso de estado (`RealtimeStatus`) devuelve `null` mientras haya conexión: un indicador
verde permanente ocupa sitio y enseña a ignorar la zona donde luego sale lo importante. Y lleva
**2 s de gracia** antes de aparecer, porque el estado arranca en `connecting` y sin ese margen
cada entrada en la pantalla enseñaría un aviso que se va solo. El texto de `disconnected` dice
qué hacer ("tira hacia abajo"), y no dice "sin conexión": se puede tener red perfecta y el canal
caído, y en ese caso escribir sigue funcionando.

### Presencia

Quién más tiene la lista abierta. Mismo patrón de puerto y adaptador, en `community`:

```ts
export interface PresenceRepository {
  watch(
    input: { communityId: string; username: string },
    onChange: (usernames: string[]) => void,
  ): () => void
}
```

El puerto habla de nombres, no de `presenceState()`. Los detalles de la API de Supabase (y sus
tres trampas silenciosas) están en la skill `supabase-data`; aquí importa dónde vive el estado:

**Ni Query ni Zustand: `useState` en el hook.** No es server state (no se lee, no se invalida,
no se cachea, no sobrevive a la pantalla) ni client state compartido (solo lo usa quien lo
mira). Es la tercera categoría, y forzar cualquiera de las dos herramientas solo añade
ceremonia y estado global que limpiar. La regla que sigue en pie es no duplicar en un store
nada que venga del servidor, y esto no viene de ninguna tabla.

**Canal aparte de `items`.** Dos canales son dos topics sobre el mismo websocket, no dos
conexiones: no hay coste de red. Compartirlo sí costaría, atando el ciclo de vida de dos
features distintas.

**Qué se enseña**: nada si no hay nadie más (`null`, no un "no hay nadie" permanente), sin
incluirte a ti, ordenado alfabéticamente (sin orden estable la línea baila en cada `sync`), tres
nombres como mucho y el resto por número, plurales por i18n (`_one`/`_other`) y no concatenando.
Si el canal se cae, la lista se vacía: enseñar a alguien de quien hace rato que no se sabe nada
es peor que no enseñar nada.

## Una URL cacheada no se entera de que el objeto cambió

Vale para cualquier recurso que se pinte desde una URL: fotos de Storage, avatares, ficheros.
Si el **contenido** puede cambiar sin que cambie el **identificador**, hay una caché en el camino
que va a servir lo viejo, y probablemente más de una.

Pasó de verdad con las fotos de artículos. La ruta era `<community_id>/<item_id>.jpg`, fija, y
sustituir la foto era un `upsert` sobre ella. Los bytes cambiaban en Supabase y en la app no se
veía nada, en ningún dispositivo:

- La query que firma la URL tiene por clave la ruta. Ruta igual, clave igual, `staleTime` alto:
  TanStack Query devuelve la URL cacheada y no vuelve a firmar.
- `expo-image` con `cachePolicy="disk"` cachea por URL. Misma URL, mismos bytes del disco.
- El otro móvil recibe su evento de Realtime, refetchea, y la fila que llega es idéntica a la
  que ya tenía. No hay nada que le diga que mire otra vez.

La tentación es invalidar la query a mano en el `onSuccess` de la mutación. Arregla el móvil que
hace el cambio y **no arregla ninguno de los demás**, que es donde de verdad duele en una app
compartida.

La regla, entonces: **haz que el cambio sea observable en los datos que ya se sincronizan.** Aquí
fue meter un timestamp en el nombre del fichero, con lo que la columna cambia, la clave de la
query cambia, la URL cambia y las dos cachés se invalidan solas por el camino que ya existía
([ADR-0007](../../../docs/adr/ADR-0007-ruta-versionada-de-las-fotos.md)).

Antes de elegir una ruta o una clave de caché, pregúntate si dos versiones distintas del recurso
pueden acabar con el mismo identificador. Si la respuesta es sí, el identificador está mal.

## Offline

### Una petición sin red no falla: se queda colgada

Es el fallo que más despista de este stack. En Android, una petición lanzada en modo avión no
se rechaza: el sistema la encola y la suelta al recuperar conexión. Sin rechazo no hay
`onError`, así que el botón se queda girando indefinidamente y **la escritura se acaba
haciendo** minutos después, sin que el usuario lo sepa.

Dos defensas, y hacen falta las dos:

```ts
// src/shared/lib/network.ts — al principio de cada método de data/
export async function assertOnline(): Promise<void> {
  const state = await NetInfo.fetch()
  if (state.isConnected === false) {
    throw new OfflineError()
  }
}
```

`=== false` y no `!state.isConnected`: NetInfo devuelve `null` mientras no lo sabe, y bloquear
al usuario por un "no lo sé" es peor que dejarle intentarlo.

La otra es el timeout, que va en el `global.fetch` del `createClient`. Cubre lo que NetInfo no
ve: wifi conectado pero sin salida a internet, o servidor que no contesta. Usa
`AbortController` + `setTimeout`, no `AbortSignal.timeout()`, que no está garantizado en el
polyfill de fetch de React Native.

`assertOnline()` va en `data/`, no en los hooks de mutación: es el sitio por el que pasan todas
las llamadas de red, así que no se puede olvidar al escribir la siguiente feature.

Mensajes distintos para problemas distintos: `errors.offline` cuando el móvil sabe que no hay
red, `errors.network` cuando lo que falla es el otro lado.

**Ojo con reintentar lo que no es idempotente.** `create_community` genera una lista nueva en
cada llamada: si la petición llegó y se perdió la respuesta, reintentar crea dos. Antes de
reintentar una mutación automáticamente, pregúntate si el servidor puede haberla ejecutado ya.

### La caché se guarda en el móvil

En AsyncStorage, no en MMKV (ver [ADR-0008](../../../docs/adr/ADR-0008-persistencia-local-de-la-cache.md)).
`PersistQueryClientProvider` en el layout raíz, y `shared/lib/query-persister.ts` decide qué entra.

Una query se guarda si lo pide:

```ts
useQuery({ queryKey: itemsKey(communityId), queryFn: ..., meta: { persist: true } })
```

Marca en la query y no lista blanca en `shared/`, porque `shared/` no importa de `features/`.
El defecto es no guardar: una query nueva no acaba en el disco de nadie por olvido.

Dos trampas que no dan ningún error:

- **`gcTime` tiene que llegar a lo que dure la caché.** Con los 5 minutos de fábrica, una query
  sin observadores se borra de memoria y lo que no está en memoria no se vuelca a disco. Se
  persistiría una caché vacía.
- **La hidratación es asíncrona.** Lo mismo que con los stores de Zustand: `useIsRestoring()` si
  necesitas saber si ya se restauró.

El `buster` combina versión e `updateId` del build. Una caché guardada por código anterior puede
tener otra forma, y rehidratarla da fallos de tipos en ejecución que no se parecen a su causa.

### Sin cobertura no se falla: se encola

`onlineManager` enganchado a NetInfo en `shared/lib/query-client.ts`. Con eso, una mutación con
`networkMode: 'online'` (el de fábrica) **no se ejecuta ni falla: se pausa**, y Query la reanuda
sola al volver la red. Ver [ADR-0009](../../../docs/adr/ADR-0009-cola-de-mutaciones-offline.md).

Para que la cola sobreviva a que Android cierre la app hay una regla que condiciona cómo se
escribe la mutación: **una función no se serializa.** Al rehidratar solo quedan `mutationKey`,
`variables` y `state`, así que el `mutationFn` se registra por clave antes de restaurar:

```ts
client.setMutationDefaults(itemMutationKeys.add, {
  scope: { id: 'items' },
  mutationFn: (input: AddItemVariables) => addItem(itemRepository, input),
  onSuccess: (_result, input) =>
    client.invalidateQueries({ queryKey: itemsKey(input.communityId) }),
})
```

De ahí, tres cosas:

- **Las `variables` cargan con todo lo que la función necesita**, `communityId` incluido. Lo que
  viva en el closure del hook desaparece al reiniciar. Para que eso no ensucie la pantalla, el
  hook devuelve un `mutate` envuelto que lo añade.
- **El hook no declara `mutationFn`**, lo hereda de su clave, y aporta solo lo que tiene sentido
  con pantalla delante: escritura optimista, rollback y snackbar. Query mezcla defaults y opciones
  del hook y gana el hook, así que los callbacks del default son los de la mutación reanudada sin
  hook montado: invalidan y avisan desde el store (`useSnackbarStore.getState()`, `i18n.t`).
- **Nada de rollback al reanudar.** El `context` rehidratado trae una foto de la lista de antes de
  cerrar la app; restaurarla pisaría lo que hayan hecho los demás. Se invalida y manda el servidor.

`scope` compartido serializa el reenvío, así que los cambios llegan en el orden en que se hicieron.

**El id de lo que se crea sin conexión lo genera el cliente**, y en la llamada a `mutate`, no en
`onMutate`:

```ts
mutate: (input: { name: string; quantity: number }) =>
  mutation.mutate({ ...input, id: randomUuid(), communityId }),
```

Un id nacido en `onMutate` vive en la caché y en el closure, pero no en las `variables`, que es lo
único que va a disco: al reiniciar, la mutación rehidratada insertaría un id distinto del que la
pantalla lleva enseñando. Y con el id del servidor no hay nada que enseñar hasta que responda, así
que cualquier cambio posterior sobre ese artículo apuntaría a un id inventado y se perdería sin
error (el `update` afecta a cero filas y Postgres no se queja).

`randomUuid()` está en `shared/lib/uuid.ts` y sale del `uuid.v4()` de `expo-modules-core`, que ya
va dentro del APK. Consecuencia útil: el alta pasa a ser idempotente, y el adaptador trata el
`23505` como «esto ya se guardó» y devuelve la fila que hay.
[ADR-0010](../../../docs/adr/ADR-0010-id-del-articulo-generado-en-el-cliente.md).

**`assertOnline()` no sobra por esto.** Es más fresco (un `NetInfo.fetch()` por llamada, frente al
último evento recibido) y cubre la ventana entre decidir que hay red y que salga la petición. Y
protege también lo que no pasa por una mutación de Query.

**Encolar no siempre es lo correcto.** `create_community` y `join_community` llevan
`networkMode: 'always'`: generan un valor que decide el servidor y no son idempotentes, así que
encolarlas sería esperar para siempre o crear dos comunidades.

**Pausada no es vacía.** Con la query en pausa, `isLoading` y `isError` son `false`, así que una
lista sin datos cae en el estado vacío y le dice al usuario que su lista compartida está vacía
cuando lo que pasa es que no se ha podido leer. Mira `isPaused` **antes** que `isError`.

- Conflictos: last-write-wins por `updated_at`. Es suficiente aquí. Que dos personas marquen
  el mismo artículo como comprado a la vez no es un problema que necesite CRDTs.

## Expo Router

Rutas por fichero en `src/app/`. El layout raíz monta los providers (Query, Paper, i18n, tema),
el `SessionGate` y el `SnackbarHost`. Los ficheros de ruta son finos: reexportan la pantalla
que vive en `features/<feature>/presentation/` y poco más.

```tsx
// src/app/join.tsx
import { JoinCommunityScreen } from '../features/community/presentation/JoinCommunityScreen'

export default JoinCommunityScreen
```

**Las rutas tipadas las genera el dev server, no `expo export`.** Con
`experiments.typedRoutes` activo, `.expo/types/router.d.ts` se regenera al arrancar
`npx expo start`. Si acabas de añadir un fichero de ruta, `tsc` va a fallar con
"is not assignable to type ... RelativePathString" hasta que arranques el server una vez.
Es un typecheck rojo que no significa nada roto, y cuesta un rato entender que el error no
está en tu código.

### La pila y el botón atrás

Una redirección en el arranque más un `replace` deja una trampa: si `index` redirige a
`/list` cuando hay comunidad guardada, y llegas a `/list` con `router.replace()` desde
`/create`, la pila queda `[index, list]`. El atrás de Android vuelve a `index`, que redirige
otra vez a `/list`. El usuario no puede salir de la app con el botón atrás.

Cuando una pantalla pasa a ser el nuevo punto de entrada, vacía la pila antes:

```ts
if (router.canDismiss()) {
  router.dismissAll()
}
router.replace('/list')
```

Regla general: después de tocar la navegación, prueba el atrás del sistema. Es el control
que más se usa en Android y el que menos se prueba.

## Snackbar

Hay un solo `Snackbar` en toda la app, montado en el layout raíz dentro del `Portal.Host`.
Las pantallas no lo renderizan: piden un mensaje.

```ts
const showSnackbar = useSnackbar()
showSnackbar(t('errors.network'))
showSnackbar(t('items.deleted'), { label: t('common.undo'), onPress: restore })
```

El estado vive en `src/shared/hooks/use-snackbar.ts` y el componente en
`src/shared/ui/SnackbarHost.tsx`. Separados a propósito: así el único import de
`react-native-paper` sigue estando dentro de `shared/ui`, que es lo que exige
[ADR-0004](../../../docs/adr/ADR-0004-libreria-de-ui.md).

Montarlo por pantalla parece más simple hasta que navegas: el snackbar se desmonta con la
pantalla y el aviso del error desaparece justo cuando el usuario iba a leerlo.

## Accesibilidad

Cada control interactivo nuevo, sin excepción:

- `accessibilityLabel` con texto de i18n y `accessibilityRole`
- área táctil ≥ 44×44 pt (usa `hitSlop` si el icono es pequeño)
- contraste AA contra su fondo, en claro **y** en oscuro
- estado nunca solo por color: "comprado" lleva icono + tachado + label, no solo gris

Una pantalla, una acción principal grande y evidente. Los valores por defecto sensatos
(cantidad = 1) ahorran más interacciones que cualquier atajo.

### Los E2E apuntan a la etiqueta de accesibilidad, no a un `testID`

Los flujos de `.maestro/` seleccionan los controles por su texto visible o por su
`accessibilityLabel`, que en Android son lo mismo para Maestro. Es a propósito: si un selector
deja de encontrar algo, casi siempre es que ese control también dejó de ser usable con TalkBack.
Un `testID` en cada botón convertiría el E2E en algo que pasa en verde mientras la app es
inaccesible.

La excepción son los campos de texto, y por un motivo concreto. `Input` pinta la etiqueta como un
`<Text>` encima **y** se la pone al `TextInput` como `accessibilityLabel`, así que hay dos
elementos con la misma cadena y el primero es la etiqueta, que no enfoca nada. Ahí sí va `testID`,
sobre el `TextInput`:

```tsx
<Input testID="add-item-name" label={t('items.add.label')} … />
```

Regla: **`testID` solo donde el texto es ambiguo**, nunca «por si acaso». Y si añades un campo que
un flujo vaya a escribir, ponle el suyo en el mismo cambio.

## i18n

Cero textos hardcodeados desde el primer commit. ES por defecto, estructura preparada para EN.
Retrofitear i18n cuando ya hay 40 pantallas es un día perdido; hacerlo desde el principio
cuesta cero.
