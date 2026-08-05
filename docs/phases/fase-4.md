# Fase 4 · Robustez y offline

- Estado: **cerrada el 2026-08-05**, los cinco incrementos escritos, verdes en local y probados en
  dispositivo
- Inicio: 2026-08-04
- Cierre: 2026-08-05

Entregable de la fase (§12 del documento maestro): beta estable, auditoría global (§11) superada.

1. [x] Caché persistente: la app abre enseñando la última lista aunque no haya red
2. [x] La sesión sobrevive a un arranque sin conexión
3. [x] Las escrituras sin cobertura se encolan en vez de fallar
4. [x] La cola sobrevive a que Android cierre la app
5. [x] Un E2E feliz con Maestro + cobertura de dominio y repos ≥ 70%

El **manejo de errores global con Sentry**, que §12 pone en esta fase, se aplaza a la Fase 5. El
motivo es el mismo que decidió [ADR-0008](../adr/ADR-0008-persistencia-local-de-la-cache.md):
`@sentry/react-native` es un módulo nativo de terceros y no arranca en Expo Go, así que meterlo
ahora cambia el flujo de trabajo de todo el proyecto para ganar telemetría de una beta que se
prueba en dos móviles conocidos. Decidido con el usuario al abrir la fase.

Las dos decisiones grandes de la fase tienen ADR propio:
[ADR-0008](../adr/ADR-0008-persistencia-local-de-la-cache.md) (dónde se guarda) y
[ADR-0009](../adr/ADR-0009-cola-de-mutaciones-offline.md) (cómo se encola).

---

## Incremento 1 · La lista se guarda en el móvil

Abrir la app sin cobertura enseñaba un spinner y luego un error. La lista existía en la caché de
TanStack Query, pero esa caché vive en memoria y muere con el proceso.

| Fichero | Qué hace |
|---|---|
| `shared/lib/query-persister.ts` | Qué se guarda, cuánto dura y cuándo se tira |
| `shared/lib/query-client.ts` | El cliente sale de `_layout.tsx` y engancha `onlineManager` |
| `app/_layout.tsx` | `PersistQueryClientProvider` en vez de `QueryClientProvider` |
| `features/items/presentation/use-items.ts` | `meta: { persist: true }` |
| `features/items/presentation/use-item-image-url.ts` | `meta: { persist: true }` |

### Se guarda lo que se marca, no lo que aparezca

```ts
export function shouldPersistQuery(query: Query): boolean {
  return query.state.status === 'success' && query.meta?.persist === true
}
```

Lo natural sería una lista blanca de claves en `shared/`. No se puede: `shared/` no importa de
`features/`, esa flecha va al revés, y la alternativa sería repetir los literales de las claves en
dos sitios que se desincronizan a la primera.

Con `meta` la marca vive junto a la query que la necesita, y el defecto es no guardar. Una query
nueva no acaba en el disco de nadie por olvido, que es la propiedad que interesa cuando lo que se
guarda puede contener datos de otra persona.

Se guardan dos: la lista de artículos y las URL firmadas de las fotos. La segunda importa más de
lo que parece: sin ella la lista abre offline pero con los huecos de las fotos vacíos.

### `gcTime` tiene que llegar a los 7 días

```ts
staleTime: 30_000,
gcTime: cacheMaxAgeMs,   // 7 días
```

Es el detalle que rompe la persistencia sin dar ningún error. El `gcTime` de fábrica son 5
minutos: una query sin observadores se borra de memoria, y **lo que no está en memoria no se
vuelca a disco**. Con la app en segundo plano un rato, se persistiría una caché vacía.

`staleTime` sigue en 30 s. Son cosas distintas: cuánto se fía uno del dato (30 s) y cuánto se
guarda por si acaso (7 días).

### El `buster` tira la caché al actualizar

```ts
export function cacheBuster(): string {
  const { version, updateId } = buildInfo()
  return `${version}-${updateId ?? 'base'}`
}
```

Si el `buster` no coincide con el guardado, se descarta todo. Lleva las dos cosas porque hay dos
formas de que llegue código nuevo: un APK (cambia `version`) y un `eas update` (cambia `updateId`,
mismo `version`). Una caché guardada por una versión anterior puede tener otra forma; rehidratarla
da fallos de tipos en tiempo de ejecución que no se parecen en nada a su causa.

### Cómo probarlo

1. Con red, abre la lista y espera a que carguen artículos y fotos.
2. Cierra la app **del todo** (recientes → deslizar).
3. Modo avión.
4. Abre la app. Debe entrar en la lista y enseñar los artículos y sus fotos.

---

## Incremento 2 · Arrancar sin conexión

El incremento 1 dejó la lista en el disco, pero no se llegaba a ver: el arranque se paraba antes,
en la sesión.

| Fichero | Qué hace |
|---|---|
| `features/session/data/supabase-session-repository.ts` | `getCurrent()` empieza por `assertOnline()` |
| `features/session/presentation/session-store.ts` | El store persiste la sesión conocida |
| `features/session/presentation/use-session-bootstrap.ts` | Sin red, tira de la sesión guardada |

### Dos síntomas, una causa

Sin red, la pantalla de arranque se quedaba ~12 s y luego enseñaba un error en crudo. La causa
está en `auth-js` y se confirmó leyendo `GoTrueClient.__loadSession` en `node_modules`, no
deduciéndola: si el access token está caducado, `getSession()` intenta renovarlo. Sin red esa
petición no se rechaza (el fallo de Android de siempre), agota el timeout del cliente de Supabase,
y el método devuelve `{ session: null, error }`.

Para el repositorio eso era «no hay sesión», así que lanzaba, `SessionGate` enseñaba su pantalla
de error, y la caché del incremento 1 quedaba detrás de una puerta cerrada.

`assertOnline()` al principio de `getCurrent()` corta los dos síntomas de golpe: sin red no se
pregunta, se lanza `OfflineError` al instante. Es además la regla general de `CLAUDE.md`, que este
método se había saltado.

### La identidad del móvil no se borra porque falle un intento

```ts
fail: (error) => set({ status: 'error', error }),
```

`fail` ya no limpia `session`. Antes lo hacía, y era un error de concepto: que un arranque falle no
significa que el dispositivo haya dejado de tener identidad. El store persiste solo `session`
(`partialize`), no `status` ni `error`, que son de este arranque y de ninguno más.

Con eso, el bootstrap puede degradar:

```ts
const known = useSessionStore.getState().session
if (cause instanceof OfflineError && known) {
  succeed(known)
  return
}
```

**Solo con `OfflineError`.** Cualquier otro fallo (token revocado, error del servidor) sigue
llevando a la pantalla de error: seguir adelante con una sesión que el servidor podría haber
invalidado es peor que decirlo.

Se comprobó antes de hacerlo que nadie consume `session.userId`: la pertenencia se resuelve en
Postgres vía `member_community_ids()` sobre `auth.uid()`. La sesión guardada sirve para pasar la
puerta, no para autorizar nada. La autorización sigue siendo cosa de RLS y del token real.

### Cómo probarlo

1. Entra en una lista con red y ciérrala del todo.
2. Modo avión.
3. Abre la app: debe entrar **sin espera perceptible**. Si tarda ~12 s o enseña un error, esto está
   roto.

---

## Incremento 3 · Sin cobertura no se falla: se espera

El razonamiento completo está en
[ADR-0009](../adr/ADR-0009-cola-de-mutaciones-offline.md). Aquí, lo que se tocó.

| Fichero | Qué hace |
|---|---|
| `shared/lib/query-client.ts` | `onlineManager.setEventListener` con NetInfo |
| `shared/hooks/use-sync-status.ts` | Si hay red y cuántos cambios esperan |
| `features/items/presentation/components/OfflineBanner.tsx` | El aviso de la cabecera |
| `features/items/presentation/ItemsScreen.tsx` | Banner según estado, y el estado `isPaused` |
| `shared/lib/i18n/es.json` | Bloque `list.offline` |

### El aviso sustituye al de Realtime, no se suma

Sin red, el aviso de «conectando para ver los cambios al momento» es ruido: claro que no hay
Realtime, no hay red. Dos avisos apilados diciendo lo mismo empujan la lista hacia abajo y no
informan de nada.

```tsx
{online ? <RealtimeStatus status={realtimeStatus} /> : <OfflineBanner pendingChanges={pendingChanges} />}
```

El texto cambia si hay algo esperando: «Sin conexión. Estás viendo la última lista guardada» sin
cambios pendientes, «Sin conexión. 2 cambios se guardarán al recuperarla» con ellos. Plural por
i18n (`_one` / `_other`), no concatenando.

### «Vacía» y «no la he podido leer» dejan de ser la misma pantalla

Es la regresión que introduce pausar las queries, y no da ningún error. Con la query en pausa,
`isLoading` es `false` y `isError` es `false`, así que la lista vacía caía en `EmptyList`, que dice
«Aquí no hay nada todavía. Escribe arriba lo primero que haya que comprar». A alguien que abre la
app por primera vez sin cobertura le estaría mintiendo sobre el contenido de una lista compartida.

```tsx
isLoading ? <LoadingList /> : isPaused ? <NoCachedList /> : isError ? <ListError … /> : <EmptyList />
```

`isPaused` va **antes** que `isError` porque es más específico: pausada es un caso concreto de
«no tengo datos» con una explicación mejor.

### Crear y unirse no se encolan

`useCreateCommunity` y `useJoinCommunity` llevan `networkMode: 'always'`. Encolarlas sería, en el
mejor caso, un botón girando para siempre esperando un `join_code` que no va a llegar; en el peor,
dos comunidades creadas. Ya estaba razonado en `docs/phases/fase-1.md`; ahora hay que decirlo
explícitamente, porque el defecto de la app pasó a ser el contrario.

---

## Incremento 4 · La cola sobrevive al cierre de la app

Los incrementos 1 y 3 **no se pueden entregar por separado**, y merece la pena entender por qué
antes de tocar esto: el 1 persiste la caché, escrituras optimistas incluidas; el 3 pausa las
mutaciones, pero una mutación en pausa vive en memoria. Un artículo añadido sin cobertura se
guardaría en disco con su id inventado y, tras un reinicio, sería un fantasma permanente: visible,
inexistente y sin nada que lo vaya a crear.

| Fichero | Qué hace |
|---|---|
| `features/items/presentation/item-mutations.ts` | Claves, variables y `mutationFn` de las cuatro mutaciones |
| `shared/lib/query-persister.ts` | `shouldDehydrateMutation` |
| `app/_layout.tsx` | Registra los defaults y reanuda al restaurar |
| `presentation/use-add-item.ts`, `use-edit-item.ts`, `use-toggle-purchased.ts`, `use-delete-item.ts` | Pasan a mutaciones con clave |

### Una función no cabe en un JSON

Es la restricción de la que sale todo lo demás. Al rehidratar, de una mutación quedan su
`mutationKey`, sus `variables` y su `state`. El `mutationFn` hay que tenerlo registrado por clave
**antes** de que la restauración ocurra, o la mutación reanudada muere con «No mutationFn found»:

```ts
// app/_layout.tsx, a nivel de módulo: corre antes del primer render
registerItemMutationDefaults(queryClient)
```

Y de ahí, el reparto: el `mutationFn` en `item-mutations.ts`, el hook con lo que solo tiene sentido
con pantalla delante. El hook ya no declara `mutationFn`; lo hereda de su clave. Así la mutación
reanudada tras un reinicio ejecuta **el mismo código** que ejecutó cuando el usuario la lanzó, no
una copia parecida.

### `communityId` viaja en las variables

Antes salía del closure del hook (`useAddItem(communityId)`). Un closure no sobrevive a un
reinicio; las variables sí, porque se serializan. Así que las variables de las cuatro mutaciones lo
llevan dentro.

Para que eso no se filtre a la pantalla, cada hook devuelve un `mutate` envuelto que lo añade:

```ts
return {
  mutate: (input: { name: string; quantity: number }) => mutation.mutate({ ...input, communityId }),
}
```

`ItemsScreen` no cambia una línea. La alternativa (pasar `community.id` en cada `mutate` desde la
pantalla, teniendo ya el hook construido con ese mismo id) se ve mal en el sitio donde se lee.

### Los callbacks de los defaults son para cuando no hay pantalla

Query mezcla defaults y opciones del hook, y **gana el hook**. Así que los `onSuccess`/`onError`
registrados por clave solo llegan a ejecutarse en la mutación reanudada sin hook montado, que es
justo donde hacen falta: invalidan la lista y, si algo falla, avisan por
`useSnackbarStore.getState()` e `i18n.t` en vez de por hooks, que ahí no existen.

No hay rollback en ese camino, a propósito. El `context` rehidratado trae el `previous` de antes de
cerrar la app, que a estas alturas es una foto vieja de la lista; restaurarla pisaría lo que hayan
hecho los demás mientras tanto. Se invalida y manda el servidor.

### `scope` para que se reenvíen en orden

Las cuatro comparten `scope: { id: 'items' }`, así que Query las ejecuta de una en una. Al recuperar
la conexión, los cambios se reenvían en el orden en que se hicieron. Sin `scope` salen todos a la
vez y dos cambios sobre el mismo artículo pueden aterrizar del revés.

Cuesta algo de paralelismo al marcar varios artículos seguidos con buena red. No se nota: el
usuario ya está viendo el resultado optimista.

### Borrar sigue difiriéndose 5 segundos

`useDeleteItem` mantiene su forma: `setTimeout` de 5 s, snackbar con «Deshacer», y el borrado real
solo si nadie deshace. Lo único que cambia es que al vencer el plazo ya no llama al repositorio
directo, sino que lanza la mutación con clave. Con eso, borrar sin cobertura pasa de «revierte y
avisa» a «se queda borrado y se confirma al volver la red».

El artículo sigue oculto mientras la mutación espera, porque `clearDeleting` está en `onSettled` y
una mutación en pausa no ha terminado. Al reiniciar la app, en cambio, el artículo reaparece un
instante: `deleting-items-store` no se persiste, y desaparece de nuevo en cuanto la cola se drena.
Se acepta: persistirlo abriría la posibilidad de un artículo oculto para siempre si su mutación se
pierde, que es un fallo peor y más difícil de entender.

### Qué se guarda de la cola

```ts
export function shouldPersistMutation(mutation: Mutation): boolean {
  return mutation.state.isPaused
}
```

Solo lo que está esperando red. Una mutación en vuelo no se guarda: o termina, o falla y ya se
ocupó su `onError` de deshacerla.

### Cómo probarlo

Este es el guion que de verdad cierra la fase. Hazlo con **un solo móvil**; el segundo entra en el
paso 8.

1. Con red, entra en la lista y espera a que cargue.
2. Modo avión. La cabecera debe cambiar al aviso «Sin conexión. Estás viendo la última lista
   guardada».
3. Marca dos artículos como comprados. Deben quedarse marcados, sin ningún error, y el aviso debe
   pasar a «2 cambios se guardarán al recuperarla».
4. Añade un artículo nuevo. Aparece arriba y el contador sube a 3.
5. Borra un artículo. Sale el snackbar con «Deshacer»; no lo toques. A los 5 s el contador sube a 4.
6. **Cierra la app del todo** (recientes → deslizar). Sigue en modo avión.
7. Ábrela otra vez. Debe entrar directa a la lista, con los dos marcados, el nuevo puesto y el
   borrado ausente, y el aviso de 4 cambios pendientes.
8. Quita el modo avión sin tocar nada más. En unos segundos el aviso debe desaparecer y la lista
   quedarse igual que estaba. **Comprueba en el segundo móvil que los cuatro cambios llegaron.**

Si en el paso 7 aparece un artículo que en el 8 se esfuma, la cola no se está guardando: es
exactamente el fantasma que este incremento existe para evitar.

---

## Incremento 5 · Cobertura y un E2E que recorra la app

| Fichero | Qué hace |
|---|---|
| `.maestro/camino-feliz.yaml` | El recorrido completo: crear lista, añadir, marcar, borrar, deshacer, salir |
| `.maestro/cola-offline.yaml` | Modo avión, cierre de la app y confirmación de que lo encolado llegó |
| `.maestro/config.yaml` | Deja fuera de la tanda por defecto lo que toca el modo avión |
| `shared/ui/Input.tsx` | `testID` opcional |
| `docs/guias/e2e-con-maestro.md` | Cómo instalarlo, ejecutarlo y limpiar lo que deja |

### La cobertura ya estaba

El umbral del 70% en `jest.config.js` no era una promesa, se cumplía. Medido con
`npm run test:coverage` sobre `domain/` y `data/` de las tres features:

| | % |
|---|---|
| Sentencias | 96.9 |
| Ramas | 93.57 |
| Funciones | 98.14 |
| Líneas | 96.8 |

Los ficheros que salen al 0% (`item.ts`, `item-repository.ts`, `community.ts`,
`presence-repository.ts`, `session.ts`) son tipos e interfaces: no tienen nada ejecutable que
cubrir y subirlos a verde exigiría tests que no comprueban nada. No se tocan.

Lo que faltaba, entonces, no era cobertura de unidades. Era que nadie comprobara nunca que la app
**se puede usar**: que el botón esté donde se pulsa, que la lista se repinte, que el borrado
diferido llegue al servidor.

### Los flujos hablan con el Supabase de verdad

No hay mocks. Cada ejecución crea una comunidad y un miembro reales, y los deja ahí: `clearState`
borra el móvil, no el servidor. Las listas quedan identificadas por nombre (`E2E Maestro`,
`E2E Offline`) y se limpian a mano.

Se descartó montar un proyecto de Supabase aparte para tests. Duplicaría migraciones, claves y
mantenimiento a cambio de evitar unas filas de basura en un flujo que se lanza a mano cada pocos
días. Si esto entra algún día en CI, la cuenta cambia y toca ADR.

### El `appId` es el nuestro, así que con Expo Go no van

Los flujos declaran `appId: com.alejandrohernandez.listacompra`. En Expo Go el proceso es
`host.exp.exponent` y el flujo tendría que navegar primero por la interfaz de Expo Go para abrir
el proyecto: pasos que cambian entre versiones y que no prueban nada nuestro. Los E2E se ejecutan
contra el APK de `preview` o contra un development build.

### Un `testID` en `Input`, y solo ahí

Es el único cambio de código del incremento y merece explicación, porque a primera vista es
código de producción escrito para el test.

`Input` pinta la etiqueta como un `<Text>` **y** se la pone al `TextInput` como
`accessibilityLabel`. En el árbol de Android eso son dos elementos con la cadena «Tu nombre», y el
primero es la etiqueta, que no enfoca nada: un selector por texto tocaría el `<Text>` y el
`inputText` siguiente se escribiría en el vacío. No es un fallo de accesibilidad (TalkBack lee la
etiqueta al enfocar el campo, que es lo correcto), es ambigüedad para un robot.

La alternativa sin tocar código era `index: 1` en el selector, que depende del orden del árbol de
vistas y no se entiende al leerlo. Se prefiere el `testID`, que es explícito y no cambia nada de
lo que ve el usuario.

Se queda en los tres campos que los flujos escriben. Los botones no lo llevan ni les hace falta:
`Button` ya pone su etiqueta como `accessibilityLabel` del `Pressable`, así que el texto identifica
al control pulsable. Esa es la regla para lo que venga: **se apunta por texto o por etiqueta de
accesibilidad**, y así un selector roto avisa de que también se rompió para quien usa lector de
pantalla. El `testID` solo donde el texto es ambiguo.

### Cómo probarlo

Hace falta el CLI de Maestro (no es dependencia de npm), un Android con `adb` y el APK instalado.
El detalle está en [`docs/guias/e2e-con-maestro.md`](../guias/e2e-con-maestro.md).

```bash
npm run test:e2e                        # camino feliz
maestro test .maestro/cola-offline.yaml # el de modo avión
```

Los dos flujos están escritos y revisados contra los textos de `es.json` y los selectores reales
de cada pantalla, pero **no se han ejecutado**: en la máquina de desarrollo no hay ni Maestro ni
`adb` instalados. La primera ejecución es del usuario y puede pedir ajustes de tiempos de espera;
los sospechosos habituales están en la sección «Cuando falla» de la guía.

---

## Deuda conocida

> **Al día de hoy (2026-08-05) la primera está arreglada en el incremento 1 de la Fase 5**: el
> cliente genera el uuid, ver [ADR-0010](../adr/ADR-0010-id-del-articulo-generado-en-el-cliente.md)
> y `fase-5.md`. Se deja escrito lo de abajo tal cual porque es lo que se sabía al cerrar esta
> fase, incluida la parte que resultó no ser cierta: no hacía falta build nueva, `expo-modules-core`
> ya trae un uuid nativo dentro del APK.

**Tocar un artículo creado en la misma sesión offline.** El alta optimista inventa un id
(`optimistic-<ts>`). Si sin cobertura añades «pan» y acto seguido lo marcas como comprado, el alta
llega bien al reconectar, pero la marca viaja con un id que el servidor no conoce: el `update` no
encuentra fila, no falla, y al refrescar la marca no está. El usuario no se entera.

El arreglo es conocido y no necesita migración: que el **cliente genere el uuid** del artículo y lo
mande en el `insert` (`items.id` es `uuid` con `default gen_random_uuid()`, se puede dar hecho).
Con eso el id optimista es el id real y toda la clase de problemas desaparece. No se hace en esta
fase porque cambia el contrato de `ItemRepository.add`, el caso de uso y sus tests, y necesita una
fuente de uuid (`expo-crypto` no está instalado; es módulo del SDK, así que Expo Go lo aguanta,
pero mete build nueva por `runtimeVersion`). Queda para la Fase 5, con su ADR.

**Primer arranque de todos sin conexión.** Un móvil que nunca ha tenido sesión y abre la app en
modo avión ve el mensaje de `OfflineError` en la pantalla de error de `SessionGate`, con el texto
correcto pero la presentación de un fallo grave. Es anterior a esta fase y no la bloquea.

**El aviso de cambios pendientes solo está en la pantalla de lista.** Es la única donde se escribe,
así que hoy alcanza.

---

## Decisiones sobre la marcha

**`react-native-mmkv` nunca estuvo instalado.** `CLAUDE.md` lo declaraba en el stack desde la Fase
0 y la Fase 4 fue la primera en necesitarlo. Se decidió con el usuario consolidar AsyncStorage en
vez de añadirlo, por el flujo de trabajo con Expo Go. Razonado en
[ADR-0008](../adr/ADR-0008-persistencia-local-de-la-cache.md); `CLAUDE.md` y la skill `expo-stack`
quedan corregidos.

**Sentry se aplaza a la Fase 5**, por el mismo motivo. Decidido con el usuario.

**`errors.syncFailed` sigue sin usarse.** Ese texto («Lo intentamos otra vez al recuperar la
conexión») se escribió en la Fase 1 pensando en esta. Ahora que la cola existe, sigue sin encajar:
cuando un cambio se encola no falla nada que anunciar (para eso está el banner), y cuando algo
falla de verdad es porque no se encoló. Se queda sin usar hasta que haya un caso que sea las dos
cosas.

**La mutación reanudada avisa con `items.errors.queuedFailed`**, un texto nuevo, en vez de reusar
`updateFailed`. Un fallo al reenviar algo que el usuario dio por hecho hace media hora necesita
decir que era un cambio pendiente; «No se pudo actualizar» ahí no se entiende.

**Los tests de mutaciones destruyen sus clientes.** Una mutación en pausa no termina nunca, y su
temporizador de recolección (5 min de fábrica) mantenía vivo el worker de Jest. `client.clear()` no
lo apaga: hay que llamar a `destroy()` en cada mutación. Sin eso el suite pasa pero Jest avisa de
handles abiertos, que es ruido que acaba ignorándose.

---

## Auditoría global (§11 del documento maestro)

El entregable de la fase es «beta estable, **auditoría global superada**», así que aquí va el
repaso de los ocho apartados. Pasa, con tres puntos que no están medidos y uno aplazado; están
señalados como tales y no colados en verde.

### A · Funcionalidad

RF-1 a RF-7 cumplidos y verificados en dos dispositivos: la lista con pendientes y comprados y el
acceso por código (Fase 1), el CRUD completo con la edición que cerraba la «M» de RF-3 y la imagen
de referencia (Fase 3), Realtime (Fase 2) y la UI accesible con su test de usuario novato
(Fase 3, F.1).

RF-7 pide sincronización entre países. Lo probado son dos móviles y dos redes; dos países no se ha
podido probar y tampoco cambia nada, porque los clientes no hablan entre sí: los dos van contra el
mismo backend y la latencia es lo único que varía.

Casos límite: nombre vacío y cantidad 0 los cubren el validador del dominio, sus tests y los
`check` de la BD (`quantity >= 1`, `char_length(name) between 1 and 120`); código inexistente
devuelve `invalid_join_code` y está probado a mano; la subida de imagen fallida está probada por
falta de red, **no** forzando un fallo de Storage con red disponible.

### B · Arquitectura

`grep -rE "from '(react|@supabase|@tanstack|zustand|expo)" src/features/*/domain/` da cero
resultados. El puerto `ItemRepository` con su adaptador Supabase sigue siendo la única vía a
Postgres, y el reparto de estado no se ha roto: nada del servidor vive en Zustand. La sesión
persistida del incremento 2 no es una excepción a eso, y merece decirlo porque lo parece: lo que
se guarda es la identidad del dispositivo, no datos de la lista, y solo sirve para pasar la
puerta. Autorizar lo sigue haciendo RLS con el token real.

### C · Stack

SDK 54 fijado, `db.types.ts` generado desde el proyecto remoto y aplicado al cliente en
`shared/lib/supabase.ts`, así que toda consulta va tipada contra el esquema real.

**Sin auditar: «dependencias abandonadas».** No se ha revisado una por una la fecha de última
publicación. Todo lo instalado viene de Expo, TanStack, Supabase o Software Mansion, que son
proveedores vivos, pero eso es un argumento, no una comprobación.

### D · Datos y sincronización

Realtime por debajo de 2 s entre dos móviles, offline que abre sin red y encola, y optimista con
rollback forzando el error con modo avión: los tres probados en dispositivo. Los índices están
desde la Fase 0.

**Sin medir: la lista de 200 artículos.** La `SectionList` es virtualizada y no hay ningún
`ScrollView` pintando filas con `.map`, así que la estructura es la correcta, pero nadie ha metido
200 filas para verlo. La lista más grande que ha existido de verdad tiene menos de veinte.

### E · Seguridad

`npm run test:rls` en 19/19 con dos sesiones anónimas reales atacando la API REST. `.env`
ignorado, comprobado con `git check-ignore`. Ni `sb_secret_` ni `service_role` aparecen en ningún
fichero del árbol. El rate limit de `join_community` y el alfabeto sin caracteres ambiguos siguen
como los dejó la Fase 0.

### F · UI/UX y accesibilidad

Los cuatro puntos, con el detalle en la auditoría F de [`fase-3.md`](fase-3.md): test de novato
superado, contraste y áreas táctiles comprobados por tests, modo oscuro y fuente grande vistos en
el móvil, y «Deshacer» funcionando con su borrado diferido.

**Aplazado: la pasada con TalkBack.** Decisión del usuario, se hace antes de publicar.

### G · Calidad de código

Lint y `tsc` limpios, 158 tests en 23 suites, cobertura de dominio y repositorios en 96.9% de
sentencias con el umbral del 70% puesto en `jest.config.js`.

**Desviación consciente en «README corto por feature»:** no existe ninguno. Lo que hay son los
diarios de fase y nueve ADR, y esa es la organización que fija `CLAUDE.md`. Un README por feature
sería un cuarto sitio donde escribir lo mismo y el primero en quedarse desfasado.

### H · Rendimiento

Imágenes comprimidas a 1280 px y JPEG al 70% antes de subir, y el bucket rechaza por encima de
2 MB. Listas virtualizadas, comprobado arriba.

**Sin medir: arranque en frío < 3 s en gama media.** No hay ninguna medición, ni un móvil de gama
media a mano. Lo único que se sabe es lo cualitativo del incremento 2: sin red la app entra
«sin espera perceptible», que era el fallo de 12 s que había que quitar.

---

## Estado de las comprobaciones

| Comprobación | Resultado |
|---|---|
| `npm run lint` | limpio |
| `npx tsc --noEmit` | limpio |
| `npm test` | 158 tests, 23 suites |
| `npm run test:coverage` | 96.9% sentencias, 93.57% ramas (umbral: 70%) |
| `npx expo export --platform android` | bundle 5.45 MB |
| `npm run test:rls` | sin cambios de esquema ni de políticas en esta fase |
| `npm run test:e2e` | **sin ejecutar**: falta Maestro y un dispositivo con `adb` |
| Prueba en dispositivo | pasada el 2026-08-05, dos móviles |

Lo que se probó y con qué resultado, junto con lo que le faltaba a la Fase 3:
[`docs/guias/prueba-de-cierre-en-dispositivo.md`](../guias/prueba-de-cierre-en-dispositivo.md).

## Cierre

El guion del incremento 4, que es el que de verdad decidía la fase, pasó entero: la lista abre sin
red y sin espera, los cuatro cambios hechos en modo avión sobrevivieron a cerrar la app del todo, y
al recuperar la conexión llegaron al segundo móvil sin que nada apareciera y se esfumara por el
camino. Ese último detalle era el objetivo del incremento: el fantasma que se produce al persistir
la caché sin persistir la cola.

Queda fuera del cierre, a propósito, la deuda del id optimista que está justo arriba, y sigue sin
ejecutarse ningún flujo de Maestro. Ninguna de las dos es criterio de esta fase.

Y quedan los tres puntos de la §11 que no están medidos: la lista de 200 artículos, el arranque en
frío en gama media y la revisión de dependencias abandonadas. Los tres son de la misma clase, hace
falta algo que aquí no hay (volumen de datos, un móvil de gama media, una pasada de mantenimiento)
y ninguno señala nada roto. Se cierra con ellos anotados en vez de darlos por verdes.
