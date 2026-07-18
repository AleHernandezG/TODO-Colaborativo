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

## Dónde vive cada estado

Pregúntate: **¿este dato podría cambiarlo otra persona desde su móvil?**

- Sí → TanStack Query. Artículos, miembros, comunidad.
- No → Zustand. Tema claro/oscuro, idioma, sesión local (`memberId`, `communityId`), estado
  de UI como "el modal está abierto".

Copiar la lista de artículos a un store de Zustand parece cómodo y rompe la app en cuanto
llega un evento Realtime: tendrías dos copias divergiendo. La caché de Query ya es un store
global, con invalidación y refetch incluidos.

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
    onError: (_error, _item, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      showSnackbar(t('errors.syncFailed'))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
```

El rollback sin aviso es peor que no hacer rollback: el artículo vuelve a su sitio solo y el
usuario cree que la app está poseída. Snackbar discreto, siempre, con texto vía i18n.

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
un diálogo de confirmación (fricción en la acción común para protegerse del caso raro),
borra en optimista y ofrece "Deshacer" en el snackbar durante ~5s. Si lo pulsa, restauras
la caché desde el snapshot que ya tienes en `onMutate`.

## Realtime

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

- La caché de Query se persiste en MMKV, así la app abre mostrando la última lista sin red.
- Las mutaciones fallidas por falta de conexión se encolan y se reenvían al recuperar red
  (NetInfo). Distingue "sin conexión" de "el servidor dijo que no": lo primero se reintenta,
  lo segundo se muestra al usuario.
- Conflictos: last-write-wins por `updated_at`. Es suficiente aquí. Que dos personas marquen
  el mismo artículo como comprado a la vez no es un problema que necesite CRDTs.

MMKV es síncrono, así que no hace falta esperar a la hidratación con una pantalla de carga.

## Expo Router

Rutas por fichero en `src/app/`: `index.tsx` (landing), `join/[code].tsx`, `list/index.tsx`.
El layout raíz monta los providers (Query, i18n, tema) y decide el redirect inicial según si
hay sesión en SecureStore. Los ficheros de ruta son finos: montan la pantalla que vive en
`features/<feature>/presentation/screens/` y poco más.

No subas el SDK de Expo por encima de la versión compatible con Expo Go de la App Store sin
preguntar antes: se prueba en un iPhone real sin build nativa.

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
