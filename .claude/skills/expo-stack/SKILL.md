---
name: expo-stack
description: Convenciones del stack móvil de este proyecto — Expo Router, TanStack Query, Zustand, MMKV, NetInfo y la arquitectura domain/data/presentation. Úsala SIEMPRE que vayas a crear o editar cualquier cosa dentro de src/ — pantallas, rutas, hooks, casos de uso, repositorios, stores o componentes de UI — y también cuando tengas que decidir dónde vive un estado, cómo escribir una mutación, cómo se propaga un cambio en tiempo real o cómo se comporta la app sin red. Aplica aunque el usuario solo diga "añade una pantalla", "haz un hook" o "guarda esto".
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

| Capa | Puede importar | Nunca importa |
|---|---|---|
| `domain/` | tipos propios, utilidades puras | React, Supabase, Query, Zustand, Expo, AsyncStorage |
| `data/` | Supabase, tipos de `domain/` | React, Query, componentes |
| `presentation/` | React, Query, Zustand, `shared/ui`, casos de uso | `@supabase/*` directamente |
| `shared/ui/` | React, RN, NativeWind, `theme/` | Query, Supabase, stores de feature |

`domain/` limpio no es purismo: es lo que permite testear `joinCommunity()` en milisegundos
sin arrancar React ni mockear red. Si necesitas Supabase dentro de `domain/`, es señal de que
esa lógica pertenece a `data/` o de que falta un puerto.

Comprobación rápida antes de cerrar una tarea:

```bash
grep -rE "from '(react|@supabase|@tanstack|zustand|expo)" src/features/*/domain/
```

Cero resultados o hay algo mal colocado.

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
      showSnackbar(error instanceof OfflineError ? t('errors.offline') : t('items.errors.addFailed'))
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
acción. No uses `errors.syncFailed` todavía: promete un reintento automático ("lo intentamos
otra vez al recuperar la conexión") que no existe hasta la cola offline de la Fase 4.

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
eso esto no es una `useMutation` normal, sino un `useCallback` que quita la fila de la caché,
programa el `delete` con un `setTimeout` y enseña el snackbar. Si el usuario deshace, cancelas
el timer y restauras desde el snapshot; el servidor nunca se enteró.

```ts
export function useDeleteItem(communityId: string) {
  const queryClient = useQueryClient()
  const showSnackbar = useSnackbar()
  const { t } = useTranslation()

  return useCallback(
    (item: Item) => {
      const key = itemKeys.list(communityId)
      const previous = queryClient.getQueryData<Item[]>(key)
      queryClient.setQueryData<Item[]>(key, (cur = []) => cur.filter((i) => i.id !== item.id))

      let undone = false
      const timer = setTimeout(() => {
        if (undone) return
        deleteItem(itemRepository, item.id).catch((error: unknown) => {
          queryClient.setQueryData<Item[]>(key, (cur = []) =>
            cur.some((i) => i.id === item.id) ? cur : [item, ...cur],
          )
          showSnackbar(error instanceof OfflineError ? t('errors.offline') : t('items.errors.deleteFailed'))
        })
      }, 5000)

      showSnackbar(t('items.deleted', { name: item.name }), {
        label: t('common.undo'),
        onPress: () => {
          undone = true
          clearTimeout(timer)
          queryClient.setQueryData<Item[]>(key, previous ?? [])
        },
      })
    },
    [queryClient, showSnackbar, t, communityId],
  )
}
```

Por qué diferir en vez de borrar ya y que "Deshacer" re-inserte: re-insertar crea una fila
nueva con otro `id` y otra fecha, así que "deshacer" no devolvería el artículo original.

Tres detalles que importan:

- **El timer sobrevive a desmontar la pantalla.** Es una promesa suelta con `queryClient`
  (que es de app), no estado de componente. Si el usuario borra y se va, el borrado se
  confirma igual, que es lo que espera.
- **Si el `delete` diferido falla, re-metes el artículo, no restauras el snapshot.** Un
  `delete` que falla significa que la fila sigue en el servidor; restaurar el snapshot entero
  pisaría lo que se haya tocado en esos 5s.
- **La clave (`itemKeys.list`) se recalcula dentro del callback** y las deps llevan
  `communityId`, no la clave: un array nuevo en cada render invalidaría el `useCallback` sin
  necesidad.

## Realtime

Hasta que Realtime esté puesto (Fase 2), la pantalla de lista se sincroniza a mano con un
`RefreshControl` (tirar para refrescar) enganchado al `refetch` de la query. Ese gesto no se
quita cuando llegue Realtime: pasa a ser el respaldo para cuando el canal se cae. Y el estado de
error de la **lectura** distingue `OfflineError` igual que las mutaciones: `errors.offline` si
el móvil sabe que no hay red, el mensaje de carga genérico en cualquier otro caso.

Cada pantalla de lista se suscribe al canal de su comunidad y deja que Query reconcilie:

```ts
useEffect(() => {
  const channel = supabase
    .channel(`items:${communityId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'items', filter: `community_id=eq.${communityId}` },
      () => queryClient.invalidateQueries({ queryKey: itemKeys.list(communityId) }),
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [communityId, queryClient])
```

Invalidar y refetchear es más tosco que parchear la caché con el payload del evento, pero es
correcto por construcción y una lista de la compra tiene decenas de filas, no miles. Si el
refetch llega a molestar, parchea entonces, no antes.

El `removeChannel` en el cleanup no es opcional: sin él acumulas suscripciones en cada
remontaje y acabas con eventos duplicados.

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

### Lo demás

- La caché de Query se persiste en MMKV, así la app abre mostrando la última lista sin red.
- Las mutaciones fallidas por falta de conexión se encolan y se reenvían al recuperar red
  (NetInfo). Distingue "sin conexión" de "el servidor dijo que no": lo primero se reintenta,
  lo segundo se muestra al usuario.
- Conflictos: last-write-wins por `updated_at`. Es suficiente aquí. Que dos personas marquen
  el mismo artículo como comprado a la vez no es un problema que necesite CRDTs.

MMKV es síncrono, así que no hace falta esperar a la hidratación con una pantalla de carga.

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

## i18n

Cero textos hardcodeados desde el primer commit. ES por defecto, estructura preparada para EN.
Retrofitear i18n cuando ya hay 40 pantallas es un día perdido; hacerlo desde el principio
cuesta cero.
