# ADR-0010: El id del artículo lo genera el cliente

- Estado: Aceptado
- Fecha: 2026-08-05
- Corrige la deuda que dejó abierta [ADR-0009](ADR-0009-cola-de-mutaciones-offline.md).

## Contexto

La cola offline de la Fase 4 funciona salvo en un caso, y el caso es realista: **añades un
artículo sin cobertura y lo tocas otra vez en esa misma sesión** (lo marcas como comprado, le
cambias la cantidad, lo borras).

El alta pintaba un artículo optimista con un id inventado en el momento, `optimistic-<timestamp>`,
porque el id de verdad lo ponía Postgres (`default gen_random_uuid()`) y no se conoce hasta que la
respuesta vuelve. Sin cobertura no vuelve nada, así que ese id falso es el único que la pantalla
tiene. Cuando después marcas ese artículo, la segunda mutación se encola con
`optimistic-1754387… ` dentro, y al recuperar la red se reenvían las dos en orden: el alta llega
bien y crea la fila con un uuid nuevo, y el `update ... where id = 'optimistic-…'` no encuentra
nada. **Postgres no da error: actualiza cero filas.** Nadie se entera. El segundo cambio se pierde
en silencio, que es la peor forma de perderlo.

El fallo es del reparto de responsabilidades, no del código: quien decide la identidad de una fila
es el servidor, pero quien necesita esa identidad para seguir trabajando es un cliente que puede
pasarse una hora sin hablar con él.

## Decisión

**El id del artículo es un uuid v4 que genera el cliente antes de mandar nada**, y el servidor lo
acepta tal cual.

Tres detalles hacen que esto funcione y ninguno es opcional:

### El uuid sale de `expo-modules-core`, envuelto en `shared/lib/uuid.ts`

```ts
import { uuid } from 'expo-modules-core'

export function randomUuid(): string {
  return uuid.v4()
}
```

Por debajo es `UUID.randomUUID()` de Java (`CoreModule.kt`), que va con `SecureRandom`. No es un
`Math.random()` disfrazado, así que la probabilidad de colisión entre dos móviles de la misma
lista es la de un uuid v4 de verdad.

### El id se genera en la llamada, no dentro de `onMutate`

```ts
mutate: (input: { name: string; quantity: number }) =>
  mutation.mutate({ ...input, id: randomUuid(), communityId }),
```

Es la parte que se puede hacer mal sin notarlo. Si el id naciera dentro de `onMutate`, existiría
solo en la caché y en el closure, y **no viajaría en las `variables`**, que es lo único que se
persiste de una mutación en pausa (ADR-0009). Al reiniciar la app, la mutación rehidratada
insertaría un artículo con un id distinto del que la pantalla lleva enseñando desde ayer, y
volveríamos al mismo agujero por otra puerta. El id va en las `variables` porque el `mutationFn`
lo necesita, y las `variables` son lo que sobrevive al disco.

### Un alta repetida no duplica: la reconoce

Con el id puesto por el cliente, reintentar un insert deja de ser peligroso y pasa a ser el modo
normal de recuperarse. Si la petición llegó al servidor pero la respuesta se perdió (timeout, red
que se cae justo después), el reintento choca contra la clave primaria y Postgres devuelve `23505`.
El adaptador lo traduce a lo que de verdad significa, «esto ya está guardado»:

```ts
if (error?.code === duplicateKey) {
  const { data: existing } = await supabase.from('items').select(columns).eq('id', id).single()
  if (existing) {
    return toItem(existing)
  }
  throw new Error(`El artículo ${id} ya se había añadido y ya no está en la lista`)
}
```

`items` no tiene más restricciones únicas que su clave primaria, así que un `23505` en esa tabla
solo puede ser este caso. Si alguna migración futura añade otra (por ejemplo, nombre único por
comunidad), esta rama deja de ser correcta y hay que mirar `error.details` antes de tragarse el
error. Queda dicho aquí porque es justo el tipo de suposición que nadie recuerda.

El `throw` del final cubre el caso raro pero posible: el alta llegó y alguien borró el artículo
antes de que reintentáramos. Devolver algo inventado ahí sería peor que fallar.

## Alternativas consideradas

**Reescribir la cola cuando el alta responde.** Dejar que el servidor ponga el id y, al llegar la
respuesta, recorrer las mutaciones en pausa sustituyendo el id falso por el bueno. Se descarta por
dos motivos. El primero es que obliga a que cada tipo de mutación declare por dónde lleva un id de
artículo, y eso hay que acordarse de hacerlo cada vez que se añada una nueva; es una regla que se
rompe sola. El segundo es que no cierra el agujero, solo lo estrecha: si Android mata la app entre
que la respuesta llega y la cola reescrita se persiste, la cola guardada sigue apuntando al id
viejo.

**Una RPC que resuelva ids temporales en el servidor.** Mandar el lote entero de cambios pendientes
a una función que sepa que `optimistic-x` es la fila que acaba de crear. Resuelve el problema de
verdad, y es lo que haría una app con sincronización propia. Se descarta por tamaño: es un
protocolo de sincronización nuevo, con su versionado y sus tests, para una lista de la compra en la
que el uuid del cliente basta.

**`expo-crypto` (`randomUUID()`).** Es la forma «oficial» y documentada. Se descarta porque no está
instalado: añadirlo es un módulo nativo más, y esta app se distribuye como APK, así que habría que
generar un build nuevo (1.2.1) para algo que `expo-modules-core` ya ofrece dentro del APK 1.2.0.
Con el uuid del core, este cambio es JavaScript puro y viaja en un `eas update`. El coste es que
`expo-modules-core/uuid` es un export público pero poco documentado; se paga envolviéndolo en
`shared/lib/uuid.ts`, que es el único sitio que habría que tocar si algún día desaparece.

**`crypto.randomUUID()` del entorno.** Hermes no trae Web Crypto. Necesitaría
`react-native-get-random-values` o similar, con lo que estamos en el caso anterior pero con una
dependencia de terceros en vez de una de Expo.

**Un id aleatorio hecho a mano** (`Math.random()` + timestamp). Cero dependencias y funciona en
cualquier sitio. Se descarta porque el id deja de ser un identificador local y pasa a ser la clave
primaria de una tabla compartida: dos móviles añadiendo a la vez en la misma lista es el uso
normal de esta app, no un caso raro, y `Math.random()` en Hermes no da garantías de nada.

## Consecuencias

**A favor**

- Un artículo añadido sin cobertura se puede marcar, editar y borrar en la misma sesión, y todo
  llega al servidor. Era el último agujero conocido del modo offline.
- El alta es idempotente. Reintentar una que quizá llegó ya no duplica filas.
- La fila que enseña la pantalla y la fila de Postgres tienen el mismo id desde el primer momento,
  así que el evento de Realtime que llega después reconcilia en vez de duplicar visualmente.

**En contra**

- **El cliente pone un valor que antes ponía la base de datos.** El `default gen_random_uuid()`
  sigue ahí para cualquier insert que no mande id, pero la app ya no lo usa. Un cliente con un
  generador roto ensuciaría la tabla; el envoltorio de `shared/lib/uuid.ts` y su test son la
  defensa.
- **Hay un camino nuevo en `add` que casi nunca se ejecuta** (el `23505`). Está cubierto por dos
  tests porque a mano es incómodo de provocar: hay que cortar la red justo entre la petición y la
  respuesta.
- La suposición sobre `23505` mencionada arriba: vale mientras `items` no tenga otra restricción
  única.

## Notas

Cómo probarlo a mano, con el guion de modo avión que antes había que evitar:
`docs/phases/fase-5.md`.
