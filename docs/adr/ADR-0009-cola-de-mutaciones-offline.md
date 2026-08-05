# ADR-0009: Cola de mutaciones offline con `onlineManager` y `assertOnline` a la vez

- Estado: Aceptado
- Fecha: 2026-08-04
- Depende de [ADR-0008](ADR-0008-persistencia-local-de-la-cache.md): la cola se guarda donde se
  guarda la caché.

## Contexto

Hasta la Fase 3, «sin conexión» significaba una cosa sola: la escritura falla, se deshace el
cambio optimista y sale un snackbar. Eso lo consigue `assertOnline()` al principio de cada método
de `data/`, y es correcto pero pobre. §8.3 del documento maestro pide otra cosa:

> Mutaciones encoladas y reenviadas al reconectar.

El caso que importa es concreto y es el 80% del uso de esta app: **estás en el súper, el móvil no
tiene cobertura dentro del edificio, y vas marcando artículos como comprados.** Con el
comportamiento de la Fase 3, cada marca revierte sola y sale un aviso. La app es inútil justo
donde se usa.

TanStack Query trae el mecanismo: si `onlineManager` sabe que no hay red, una mutación con
`networkMode: 'online'` (el de fábrica) **no se ejecuta ni falla: se queda en pausa**, y el
cliente la reanuda solo al volver la conexión. Pero eso, tal cual, tiene dos agujeros:

1. `onlineManager` no está enganchado a nada en React Native. Sin un `setEventListener`, cree que
   siempre hay red y nunca pausa nada.
2. Una mutación en pausa vive **en memoria**. Si Android mata la app (que es lo normal cuando la
   dejas en segundo plano dentro de un súper), la cola desaparece.

Y hay un tercer problema, más sutil, que aparece al juntar esto con la caché persistida del
incremento 1: **la escritura optimista sí se persiste, pero la mutación que la respalda no.** Un
artículo añadido sin cobertura se guarda en disco con un id falso (`optimistic-<ts>`), y al
reabrir la app se ve un artículo que no existe en ningún sitio y que nunca va a existir. La caché
persistida sin cola persistida es peor que no persistir nada.

## Decisión

**Se implementan las tres piezas juntas, porque ninguna es correcta sin las otras dos.**

### 1. `onlineManager` enganchado a NetInfo

```ts
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
)
```

`isConnected !== false` en vez de `!!state.isConnected`, igual que `assertOnline` usa `=== false`:
NetInfo devuelve `null` mientras no lo sabe, y tratar un «no lo sé» como «no hay red» pausaría
escrituras que habrían funcionado.

### 2. La cola sobrevive al cierre de la app

`shouldDehydrateMutation: (m) => m.state.isPaused` guarda las mutaciones en pausa junto a la
caché, y `resumePausedMutations()` en el `onSuccess` de `PersistQueryClientProvider` las reanuda
al restaurar.

Esto obliga a un cambio de forma en los hooks de mutación, y es la parte que hay que entender
antes de tocar nada: **una función no se serializa.** Al rehidratar, la mutación solo trae su
`mutationKey`, sus `variables` y su `state`; el `mutationFn` tiene que estar registrado en el
cliente de antemano, por clave:

```ts
client.setMutationDefaults(itemMutationKeys.add, {
  mutationFn: (input) => addItem(supabaseItemRepository, input),
})
```

De ahí salen dos reglas:

- **El `mutationFn` vive en `item-mutations.ts`, no en el hook.** El hook aporta lo que solo tiene
  sentido con pantalla delante (escritura optimista, rollback, snackbar); la clave aporta lo que
  tiene que funcionar sin ella. Así una mutación reanudada tras un reinicio ejecuta exactamente el
  mismo código que ejecutó la primera vez.
- **Las `variables` cargan con todo lo que el `mutationFn` necesita, incluido `communityId`.**
  Antes venía del closure del hook. Un closure no sobrevive a un reinicio; las variables sí,
  porque van a disco.

Los `onSuccess`/`onError` registrados en los defaults son la red de seguridad de la mutación
reanudada, que se ejecuta sin hook montado: invalidan la lista y, si falla, avisan por snackbar
desde el store (`useSnackbarStore.getState()`, no el hook). Cuando sí hay hook, sus callbacks
pisan a los del default, así que el comportamiento en caliente no cambia.

Las cuatro mutaciones de artículos comparten `scope: { id: 'items' }`. Eso las serializa: al
recuperar la conexión se reenvían en el orden en que se hicieron, en vez de en tropel.

### 3. `assertOnline()` se queda donde está

Podría parecer redundante: si `onlineManager` ya pausa, la petición nunca sale. Se queda por dos
motivos.

- Es **más fresco**. `assertOnline` hace un `NetInfo.fetch()` en el momento de la llamada;
  `onlineManager` refleja el último evento recibido. Entre «decidí que había red» y «la petición
  sale» cabe perfectamente que la red se caiga, y ahí vuelve el fallo de la Fase 1: en Android una
  petición sin red no se rechaza, se queda colgada y se ejecuta minutos después.
- Es **la última línea, y está en el sitio por el que pasa todo**. `onlineManager` protege lo que
  se llama a través de una mutación de Query; `assertOnline` protege también lo que no.

## Alternativas consideradas

**Cola propia en AsyncStorage.** Una lista de operaciones pendientes escrita a mano, drenada al
volver la red. Da control total sobre el orden y sobre los reintentos. Se descarta porque hay que
reimplementar la mitad de lo que ya trae Query (estado de la mutación, reintentos con backoff,
reconciliación con la caché) y, sobre todo, porque duplicaría la escritura optimista: la caché de
Query y la cola serían dos fuentes de verdad del mismo cambio pendiente, divergiendo en cuanto
llegue un evento de Realtime.

**Persistir la caché pero no la cola.** Es lo que quedaría si se cerrase la Fase 4 con solo el
incremento 1. Se descarta explícitamente: es el escenario del artículo fantasma descrito arriba.
Una app que enseña un artículo que no existe es peor que una que no enseña nada.

**Persistir la cola pero no la caché.** Coherente, pero deja fuera lo que más se pide: abrir la
app en el súper y **ver** la lista sin cobertura. Leer es más frecuente que escribir.

**`networkMode: 'always'` en todo y confiar en el timeout del cliente.** Es lo que había. Se
descarta porque convierte cada acción sin cobertura en un error visible, que es el problema que
esta fase existe para resolver. Se mantiene, eso sí, en `create_community` y `join_community`:
generan un valor que el servidor decide (`join_code`) y no son idempotentes, así que encolarlas
sería o esperar para siempre o crear dos comunidades. Ver `docs/phases/fase-1.md`.

## Consecuencias

**A favor**

- Marcar, añadir, editar y borrar funcionan sin cobertura y se sincronizan solos al volver, aunque
  la app se haya cerrado en medio.
- El código que se reenvía es el mismo que se ejecutó en caliente: un solo `mutationFn` por
  acción.
- El orden de reenvío es el orden real de los cambios.

**En contra**

- **Un cambio sobre un artículo creado en la misma sesión offline se pierde.** El alta optimista
  usa un id inventado (`optimistic-<ts>`); si sin conexión añades «pan» y acto seguido lo marcas
  como comprado, la marca viaja con un id que el servidor no conoce, no encuentra fila y no hace
  nada. El alta sí llega. Es la deuda conocida de esta fase y está anotada en
  `docs/phases/fase-4.md` con su arreglo (que el cliente genere el uuid del artículo).
- **Una foto encolada depende de un fichero de la caché del sistema.** El `uri` que devuelve el
  selector apunta al directorio de caché de la app, que Android puede vaciar. Si al reanudar ya no
  está, la mutación falla, avisa y la fila vuelve a lo que dice el servidor. Se persiste igual
  porque el caso normal es que el fichero siga ahí, y descartarla de entrada perdería también el
  cambio de nombre y cantidad que iba en la misma edición.
- **Hay dos comprobaciones de red** (`onlineManager` y `assertOnline`) y hay que saber para qué
  sirve cada una. Documentado arriba y en la skill `expo-stack`.
- **Un cambio en la forma de las `variables` rompe la cola guardada** de quien actualice con
  cambios pendientes. Lo cubre el `buster` de la caché, que incluye versión e `updateId`: al
  actualizar, lo guardado se descarta entero en vez de rehidratarse mal.

## Notas

Cómo probarlo a mano, incluido el guion de modo avión: `docs/phases/fase-4.md`.
