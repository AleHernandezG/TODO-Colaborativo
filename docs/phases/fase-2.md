# Fase 2 · Colaboración en tiempo real

- Estado: **cerrada**, probada en dos dispositivos
- Inicio: 2026-08-02 · Cierre: 2026-08-03

Entregable de la fase (§12 del documento maestro): dos dispositivos en redes distintas ven el
mismo cambio en menos de 2 segundos, sin tirar para refrescar. **Cumplido y verificado en
Android real.**

1. [x] Migración: `replica identity full` en `items`
2. [x] Suscripción Realtime y reconciliación con TanStack Query
3. [x] Indicador de conexión y reconexión
4. [x] Presencia
5. [x] Versión visible en la app (no planificado, salió al entregar)

---

## Incremento 1 · `replica identity full` en `items`

Único cambio de base de datos de la fase, y va primero porque el resto se construye encima.
Migración `20260802140000_items_replica_identity_full.sql`, una línea:

```sql
alter table items replica identity full;
```

### Por qué

Cuando Postgres emite un `DELETE` por replicación lógica, por defecto solo escribe en el WAL
**la clave primaria** de la fila borrada. El resto de columnas no viajan. Eso rompe el filtro
por comunidad que la app necesita: `filter: community_id=eq.<id>` no se puede evaluar sobre un
borrado si el `community_id` no está en el registro.

Las dos salidas de eso son malas. Si Realtime decide no entregar lo que no puede filtrar, un
artículo que otro borre se queda pintado en tu pantalla hasta que reinicies la app. Si decide
entregarlo a todos, estás recibiendo eventos de comunidades ajenas, que es exactamente lo que
`CLAUDE.md` prohíbe.

Con `replica identity full` la fila vieja entera va al WAL, Realtime evalúa el filtro en el
servidor y el borrado llega solo a quien tiene que llegar.

Coste: cada `UPDATE` y cada `DELETE` escriben la fila anterior completa en el WAL en vez de
solo la clave. En una tabla de cinco columnas cortas es irrelevante.

Alternativa descartada: dejar el valor por defecto y detectar los borrados con un refetch
periódico. Más tráfico, peor latencia, y un caso (borrar y salir de la pantalla) que no
converge nunca.

`items` ya estaba en la publicación `supabase_realtime` desde la Fase 0, así que no hizo falta
tocarla. **`db.types.ts` no se regenera**: la replica identity no es parte del esquema que
generan los tipos, ninguna tabla ni columna cambia de forma.

### Test nuevo: `npm run test:realtime`

`scripts/realtime-check.mjs`, en la misma línea que `test:rls`: abre **dos sesiones anónimas
de verdad**, crea dos comunidades y se suscribe con tres canales a la vez (A filtrado a su
comunidad, B filtrado a la suya, y uno sin filtro como sonda). Después inserta, modifica y
borra un artículo en la comunidad de A y mira qué recibió cada uno.

Que la migración esté aplicada no prueba que Realtime entregue lo que la app necesita, igual
que tener políticas RLS no prueba que aíslen. Por eso se comprueba por comportamiento.

```
OK   El canal filtrado por comunidad se suscribe
OK   Llega el alta con su community_id
OK   Llega la modificación
OK   replica identity full activo: el UPDATE trae la fila anterior entera
OK   Llega el borrado al canal de su comunidad
OK   El borrado identifica la fila
OK   El canal de B no recibe nada de la comunidad de A
OK   Sin filtro no se filtra ningún dato de la comunidad ajena
```

### Lo que descubrió el test (y que cambia el incremento 2)

**El payload del `DELETE` trae solo el `id`, aunque la replica identity sea `full`.** Realtime
recorta a propósito la fila borrada a su clave primaria antes de mandarla. La primera versión
del test daba esto por fallo y la conclusión parecía ser que la migración no había servido de
nada. No era así: lo que arregla `replica identity full` no es **lo que recibes**, es que el
**enrutado** sea correcto. La prueba de que está activo se ve en el `old` de un `UPDATE`, que
sí llega con la fila anterior completa (`old.community_id`, `old.is_purchased = false`). Los
asserts se reescribieron para comprobar la propiedad de verdad; el que estaba equivocado era
yo, no la migración.

Consecuencia para el código: **el cliente no puede fiarse del contenido del payload de un
borrado**. Con el `id` basta para la estrategia elegida (invalidar la query), pero cierra la
puerta a aplicar el borrado directamente sobre la caché usando datos del evento.

**Un canal sin `filter` recibe los borrados de todas las comunidades**, reducidos a un uuid
suelto. RLS no se puede evaluar sobre una fila que ya no existe, así que Realtime ni lo
intenta. No es un agujero grave (un uuid sin nada más no dice nada de nadie) y no se puede
desactivar, pero fija una regla: **la app se suscribe siempre con `filter: community_id`**.
Con filtro, esos borrados ajenos no llegan. Comprobado: el canal de B no recibió ni uno solo
de los tres eventos de A. Anotado en la skill `supabase-data` como error de revisión.

**Hay una ventana de en torno a un segundo tras `SUBSCRIBED` en la que los eventos se
pierden.** El canal informa de que está suscrito antes de que el servidor tenga registrada la
suscripción a los cambios. El primer intento del test insertaba nada más recibir `SUBSCRIBED`
y el alta no llegaba nunca, mientras que la modificación y el borrado (1,5 s después) sí. No
es una rareza del test: es el peor momento posible en la app real, porque lo que otro añada
justo cuando abres la lista se perdería sin dejar rastro.

Esto se lleva al incremento 2: **después de suscribirse hay que refrescar la query**, no solo
al reconectar. Lo que se haya perdido en esa ventana entra por la lectura normal. Estaba
planeado para el incremento 3 (reconexión) y sube al 2, porque no es un caso de red mala sino
el arranque normal de cualquier pantalla.

### Decisiones sobre la marcha

**El test de Realtime va en un script aparte, no dentro de `npm run test:rls`.** Son dos cosas
distintas: uno ataca la API REST con `fetch` y no necesita websockets; el otro necesita
`@supabase/supabase-js` y esperas de segundos. Meterlos juntos haría que la comprobación de
aislamiento, que es la crítica, tardase seis veces más y se ejecutase menos. `test:rls` sigue
dando 13/13 sin tocarse.

**El test espera con temporizadores, no con reintentos.** Es feo y es lo correcto aquí: la
propiedad que se comprueba incluye la ausencia de eventos ("B no recibe nada"), y eso solo se
puede afirmar tras esperar un rato razonable. Un reintento hasta que llegue algo no puede
probar que no llega nada.

**No se ha ejecutado el contrafactual.** Lo limpio sería quitar la replica identity, ver el
test fallar y volver a ponerla, pero eso significa tocar el esquema remoto a mano fuera de una
migración, que es justo lo que prohíbe la skill, y en esta máquina no hay Docker ni `psql`
para hacerlo de otra forma. La necesidad de la migración se apoya en el razonamiento de arriba
más un hecho observado: el canal de B, filtrado por su comunidad, **no** recibió el borrado de
A, y eso solo puede pasar si el servidor pudo leer el `community_id` de la fila ya borrada.

### Lo que salió de rebote

`db.types.ts` estaba commiteado en **UTF-16LE con BOM**. `npm run lint` fallaba con
`Parsing error: File appears to be binary` en ese único fichero, y llevaba así desde que se
generó: el comando de `CLAUDE.md` usa `>` y en PowerShell 5.1 esa redirección escribe UTF-16.
`tsc` entiende el BOM y no se queja, así que typecheck salía verde y el problema no se veía
por ningún lado.

Convertido a UTF-8 (18.982 → 9.166 bytes, mismo contenido, 325 líneas). Con eso `npm run lint`
vuelve a estar en 0 errores. El comando de `CLAUDE.md` lleva ahora el aviso y la skill
`supabase-data` la variante de PowerShell con `Out-File -Encoding utf8`.

No es un cambio que tocase hacer en este incremento, pero lint limpio es puerta obligatoria
para cerrarlo y no se puede reportar en verde algo que está en rojo.

### Cómo probarlo

Esto es backend, así que se prueba con el script, no con el móvil:

```bash
npm run test:realtime    # 8/8
npm run test:rls         # 13/13, no debe haberse movido
```

Si `test:realtime` falla en "El canal filtrado por comunidad se suscribe", el problema es de
conexión o de las claves del `.env`, no de la migración. Si falla en "El canal de B no recibe
nada de la comunidad de A", para: eso es una fuga entre comunidades.

En el móvil todavía no se nota nada. La app no se suscribe a nada hasta el incremento 2.

### Verificado

- `eslint`: 0 errores (tras arreglar la codificación de `db.types.ts`)
- `tsc --noEmit`: limpio
- `jest`: 79 tests, sin cambios (el incremento no toca `src/`)
- `npm run test:rls`: 13/13
- `npm run test:realtime`: 8/8
- `npx expo export --platform android`: compila, bundle 5.3 MB
- `npx supabase migration list --linked`: `20260802140000` aplicada en remoto

### Deuda que se asume aquí

- **El contrafactual de la migración no está probado.** Ver arriba.
- **Los borrados ajenos reducidos a uuid siguen llegando a un canal sin filtro.** No se puede
  evitar desde nuestro lado; se evita no suscribiéndose nunca sin filtro. La regla está en la
  skill, pero nada la impide por código.
- **El test de Realtime deja basura si falta `SUPABASE_SECRET_KEY`**, igual que `test:rls`:
  imprime los ids de las comunidades para borrarlas a mano desde el panel.

---

## Incremento 2 · Suscripción y reconciliación

Aquí es donde la app deja de necesitar que tires para refrescar. Ficheros:

| Fichero | Qué hace |
|---|---|
| `domain/item-repository.ts` | El puerto gana `subscribe()` y el tipo `ItemsChannelStatus` |
| `domain/visible-items.ts` | Función pura: esconde los artículos en ventana de deshacer |
| `data/supabase-item-repository.ts` | Monta el canal, traduce estados, devuelve la baja |
| `presentation/deleting-items-store.ts` | Zustand con los ids de borrado en curso |
| `presentation/use-items-realtime.ts` | Se suscribe mientras la pantalla está montada |
| `presentation/use-items.ts` | Filtra por `visibleItems` en el `select` |
| `presentation/use-delete-item.ts` | Marca en vez de tocar la caché |
| `presentation/ItemsScreen.tsx` | Una línea: `useItemsRealtime(community.id)` |

### La suscripción va en el puerto

La skill `expo-stack` traía un ejemplo de Realtime que hacía `supabase.channel(...)` dentro de
un `useEffect` de la pantalla. Eso contradice la tabla de fronteras de esa misma skill, que
prohíbe importar `@supabase/*` desde `presentation/`. Se ha resuelto a favor de la tabla y se
ha reescrito el ejemplo.

```ts
subscribe(communityId: string, handlers: {
  onChange: () => void
  onStatus: (status: ItemsChannelStatus) => void
}): () => void
```

Suscribirse es acceso a datos y el sitio del acceso a datos es el repositorio. Devuelve la
función de baja en vez de una promesa porque quien llama es un `useEffect` y lo que necesita es
algo que ejecutar en el cleanup.

El adaptador traduce los cuatro estados del canal de Supabase (`SUBSCRIBED`, `CHANNEL_ERROR`,
`TIMED_OUT`, `CLOSED`) a tres del dominio (`connecting`, `connected`, `disconnected`). Misma
razón por la que traduce `is_purchased` a `isPurchased`: los nombres del proveedor no cruzan
la frontera.

`onStatus` existe ya aunque nadie pinte nada con él todavía. El indicador de conexión es el
incremento 3; adelantar el cableado ahora cuesta cuatro líneas y evita reabrir el puerto
después.

### `subscribe()` no llama a `assertOnline()`

Es una excepción a una regla dura de `CLAUDE.md`, así que va explicada y anotada allí.

`assertOnline()` existe porque en Android una petición sin red no se rechaza: se queda colgada
y se ejecuta sola al reconectar. Un canal de Realtime no es eso. Tiene su propio bucle de
reconexión, y su estado no se consulta, se recibe por `onStatus`. Si la suscripción fallase
cuando NetInfo dice que no hay red, la pantalla se quedaría sin canal para siempre: nadie la
volvería a intentar al recuperar la conexión. Además `subscribe` es síncrono, no hay dónde
esperar a NetInfo.

Hay un test que lo fija (`se suscribe aunque NetInfo diga que no hay red`), para que no
"vuelva" por parecido con los otros métodos.

### Los dos temporizadores del hook

```ts
const eventCoalesceMs = 300
const subscribeSettleMs = 1500
```

**300 ms para agrupar ráfagas.** Marcar cinco artículos seguidos son cinco eventos. Sin
agrupar, cinco invalidaciones y cinco lecturas. Cada evento reprograma el temporizador, así
que una ráfaga acaba en una sola lectura. 300 ms está por debajo de lo que se percibe como
retraso y muy por encima de lo que tardan en llegar los eventos de una misma acción.

**1,5 s tras conectar.** Es la respuesta al hallazgo del incremento 1: hay alrededor de un
segundo tras `SUBSCRIBED` en el que el servidor todavía no tiene registrada la suscripción y
los eventos se pierden sin dejar rastro. Al pasar a `connected` se programa un refetch pasado
ese margen, y lo que se haya perdido entra por la lectura normal.

No hace falta un refetch inmediato además de ese: la query ya lee al montar la pantalla, así
que el usuario ve datos desde el principio. Lo que cubre el retardo es solo el hueco entre esa
primera lectura y el momento en que el canal empieza a escuchar de verdad.

### No se invalida con una mutación en vuelo

`queryClient.isMutating() > 0` → reprograma en vez de invalidar.

El test de Realtime confirma que **tu propio `insert` te llega a ti también** (comprobación
"Quien escribe también recibe su propio evento"). Sin la guarda, ese evento invalida mientras
el alta optimista está a medias: el refetch aterriza con datos del servidor que todavía no
incluyen la fila, el artículo desaparece, y vuelve cuando el `onSuccess` de la mutación
invalida otra vez. Un parpadeo en la acción más frecuente de la app.

El `cancelQueries` del `onMutate` no basta: cancela lo que hay en vuelo en ese instante, no lo
que se lance después. Reprogramar es seguro porque la mutación invalida por su cuenta al
terminar.

### El conflicto de verdad: Realtime contra el borrado con deshacer

Durante los 5 s de la ventana de deshacer, el artículo no se ve pero **sigue en el servidor**.
La Fase 1 lo escondía quitándolo de la caché de Query. Con Realtime eso se rompe: llega un
evento de otra persona, se invalida, el refetch trae la fila de vuelta y el artículo reaparece
con el botón Deshacer todavía en pantalla.

La caché de Query es el reflejo de lo que hay en el servidor y no debe mentir. Lo que se
esconde por una decisión local es estado de UI, y eso va en Zustand:

```ts
useDeletingItemsStore   // ids: string[]
visibleItems(items, deletingIds)   // en el select de useItems
```

Así el refetch puede traer la fila las veces que quiera: no se pinta porque el `select` la
filtra. Deshacer es quitar el id del store, y la fila vuelve sola sin restaurar nada.

De rebote se cae el snapshot que restauraba `Deshacer`, que era deuda de la Fase 1: restaurar
el estado entero de hace 5 s pisa lo que otras personas hayan cambiado en ese rato. Con
Realtime eso pasa de improbable a normal.

El filtrado es una función pura en `domain/visible-items.ts` con sus tests, no un `.filter()`
suelto en el hook. Es la regla ("qué se ve") y las reglas son del dominio.

Orden en el camino de éxito, que importa:

```ts
.then(() => { setQueryData(quitar la fila); invalidateQueries() })
.finally(() => clearDeleting(id))
```

`setQueryData` es síncrono y `.finally()` corre después del `.then()`, así que no existe
ningún instante en que la fila esté ya sin marca y todavía en la caché. Al revés, parpadea.

En el camino de error no hay nada que restaurar: la fila sigue en la caché, quitarle la marca
la devuelve a la pantalla, y el snackbar avisa. Que el `delete` falle significa justo que el
servidor todavía la tiene.

### El token de la sesión anónima sí llega al socket

Comprobado, porque si no llega el síntoma es "no pasa nada" y se pierde media tarde buscando
en el sitio equivocado. Dos piezas:

`supabase-js` engancha `onAuthStateChange` y llama a `realtime.setAuth(token)` en
`INITIAL_SESSION`, `SIGNED_IN` y `TOKEN_REFRESHED` (`_handleTokenChanged`, en
`node_modules/@supabase/supabase-js/dist/index.mjs`). `INITIAL_SESSION` es el que dispara al
restaurar la sesión desde AsyncStorage, y `TOKEN_REFRESHED` mantiene autorizado un canal que
lleve horas abierto, porque el cliente va con `autoRefreshToken: true`.

Y el `SessionGate` no renderiza a sus hijos hasta que `ensureSession()` resuelve, así que
`ItemsScreen` no se monta —y no se suscribe— antes de que exista sesión. Sin eso, el canal se
abriría con la clave publishable a secas y `postgres_changes`, que respeta RLS, no entregaría
nada.

### Test nuevo en `npm run test:realtime`: dos miembros de la misma lista

El script del incremento 1 probaba el aislamiento entre comunidades distintas, que es lo que
había que asegurar entonces. Lo que entrega este incremento es lo contrario: **dos personas en
la misma lista**. No estaba cubierto.

Se añade un tercer cliente que se une a la comunidad de A con su `join_code` y escribe:

```
OK   El alta de un miembro llega al otro miembro de la misma lista — INSERT pan
OK   Quien escribe también recibe su propio evento — 1 evento(s) en el canal del segundo miembro
```

10/10. La segunda comprobación no es de adorno: es la que justifica la guarda de
`isMutating()`.

### Decisiones sobre la marcha

**El `select` de la query filtra; el `queryFn` no.** La alternativa era filtrar dentro de
`listItems` pasándole los ids. Se descartó: el dominio no debe saber nada de una ventana de
deshacer que es puro artefacto de UI, y filtrar en el `queryFn` deja la caché con datos ya
recortados, que es lo que se quería evitar.

**El store de borrados no distingue comunidad.** Un `string[]` global de ids. Solo puede haber
una lista abierta a la vez, los ids son uuid y la ventana dura 5 s. Meter un mapa por
comunidad sería precisión que nadie va a usar.

**`useItemsRealtime` no devuelve nada útil todavía y se llama sin asignar.** El valor de
`status` se empieza a usar en el incremento 3.

**La suscripción vive en `ItemsView`, no en el layout.** Muere con la pantalla, que es lo
correcto: un canal abierto en segundo plano gasta batería y no sirve para nada mientras no hay
lista a la vista. El coste es la ventana de 1,5 s cada vez que se entra, que ya está cubierta.

### Cómo probarlo

Automático:

```bash
npm run test:realtime    # 10/10
npm test                 # 88 tests
```

A mano, y aquí hacen falta **dos dispositivos** (o un móvil y el emulador). Uno solo no puede
probar esta fase:

1. En el móvil A, entra en una lista y copia el código de invitación.
2. En el B, únete con ese código y otro nombre.
3. **Añadir**: escribe un artículo en A. Debe aparecer en B en menos de 2 s, sin tocar nada.
4. **Marcar**: márcalo como comprado en B. Debe saltar de sección en A.
5. **Borrar sin deshacer**: bórralo en A. Desaparece en A al instante y en B a los ~5 s
   (cuando se confirma el borrado de verdad).
6. **Borrar y deshacer**: borra un artículo en A y, mientras el snackbar sigue en pantalla,
   añade otro artículo desde B. En A tiene que aparecer el de B **sin que reaparezca el
   borrado**. Este es el caso que rompía; si el artículo borrado vuelve, el filtro por
   `visibleItems` no está funcionando.
7. **Ráfaga**: marca cuatro artículos seguidos en B. En A deben actualizarse todos, y la lista
   no debe parpadear cuatro veces.
8. **Respaldo**: pon A en modo avión, cambia algo en B, quita el modo avión. Tirar para
   refrescar sigue trayendo el cambio. Que se recupere solo es el incremento 3, todavía no.

### Verificado

- `eslint`: 0 errores
- `tsc --noEmit`: limpio
- `jest`: 88 tests (79 + 4 de `visible-items` + 5 de `subscribe`)
- `grep` de frontera: `domain/` sin imports de React, Supabase, Query, Zustand ni Expo
- `npm run test:realtime`: 10/10
- `npm run test:rls`: 13/13, sin moverse
- `npx expo export --platform android`: compila, bundle 5.3 MB
- **En dispositivo (dos Android con el APK de `preview`): los ocho pasos de arriba, correctos**

### Deuda que se asume aquí

- **No hay prueba automática de la reconciliación en el cliente.** Lo pura (`visibleItems`) y
  lo del adaptador (`subscribe`) están cubiertos; el pegamento (`use-items-realtime`) no,
  porque el proyecto no tiene montado un entorno de test para hooks con Query. Se prueba a
  mano con los pasos de arriba.
- **Si el canal se cae, la pantalla no se entera.** `onStatus` ya lo dice, pero nadie escucha.
  Incremento 3.
- **Nada obliga por código a suscribirse con filtro.** Sigue siendo una regla escrita.
- **La reprogramación por `isMutating()` no tiene tope.** Depende de que las mutaciones
  terminen, y terminan porque el cliente de Supabase lleva timeout. Si algún día una mutación
  se pudiera quedar viva indefinidamente, esto sería un bucle.

---

## Incremento 3 · Indicador de conexión y recuperación

El incremento 2 dejaba la sincronización funcionando y a la vez muda: si el canal se caía, la
pantalla seguía enseñando la última lista como si nada. Para el usuario objetivo eso es peor
que un error, porque no hay nada que le diga que lo que ve está viejo.

| Fichero | Qué hace |
|---|---|
| `shared/hooks/use-app-foreground.ts` | Avisa cuando la app vuelve del segundo plano |
| `presentation/components/RealtimeStatus.tsx` | El aviso, cuando toca |
| `presentation/use-items-realtime.ts` | Refresca también al volver a primer plano |
| `shared/lib/i18n/es.json` | `list.realtime.connecting` y `list.realtime.disconnected` |

### El aviso solo aparece cuando molesta que no esté

Nada de un punto verde permanente de "conectado". Que la app funcione es lo normal y no
necesita anunciarse; ocupa sitio y enseña al usuario a ignorar la zona donde luego saldrá lo
importante. `RealtimeStatus` devuelve `null` mientras el estado sea `connected`.

**Dos segundos de gracia antes de enseñarlo.** Al abrir la lista el estado arranca en
`connecting` y tarda un momento en pasar a `connected`. Sin ese margen, cada entrada en la
pantalla enseñaría un aviso que desaparece solo, que es justo la clase de parpadeo que hace
que la app parezca rota. El mismo margen se traga las reconexiones cortas, que no merecen
interrumpir a nadie.

El aviso distingue los dos estados porque piden cosas distintas del usuario:

- `connecting` → "Conectando para ver los cambios al momento…". Informativo, no pide nada.
- `disconnected` → "Los cambios de los demás no llegan solos. Tira hacia abajo para
  actualizar." Dice **qué hacer**, no solo qué falla.

No se dice "sin conexión" a secas: no es lo mismo que estar sin internet. Se puede tener red
perfecta y el canal caído, y en ese caso añadir artículos sigue funcionando. Confundir los dos
casos haría que el usuario dejara de usar la app pensando que no puede.

Accesibilidad: `accessibilityLiveRegion="polite"` para que el lector de pantalla lo anuncie sin
cortar lo que esté diciendo, `accessible` con `accessibilityLabel` para que se lea como una
sola frase en vez de deletrear el símbolo, y el estado no depende del color (símbolo + texto,
sobre `surface` como el resto de la pantalla).

### Tres formas de recuperarse, y ninguna sobra

1. **El canal se recupera solo.** Cuando vuelve a `SUBSCRIBED`, el `onStatus` ya programaba un
   refetch desde el incremento 2. No hizo falta código nuevo: la reconexión y el arranque son
   el mismo caso, un canal que empieza a escuchar y no sabe qué se perdió.
2. **Volver a primer plano.** Android congela los temporizadores de una app en segundo plano y
   puede cerrarle el socket sin avisar. `useAppForeground` engancha `AppState` y refresca al
   volver. Es el momento exacto en que el usuario mira la pantalla esperando datos buenos.
3. **Tirar para refrescar.** Sigue ahí, como decía la skill. Es el único que el usuario
   controla, y es el que le queda cuando los otros dos fallan.

`useAppForeground` va en `shared/hooks` y no en la feature: no tiene nada de artículos, y la
pantalla de comunidad va a querer lo mismo.

### Detalles de implementación que cuestan un rato entender

**El callback en un `useRef`.** `useAppForeground` recibe una función que cambiaría en cada
render; guardarla en una ref y suscribirse a `AppState` una sola vez evita quitar y poner el
listener constantemente. La ref se actualiza en un efecto, no durante el render.

**`scheduleRefresh` también es una ref.** El `useEffect` de la suscripción es dueño del
temporizador, y el aviso de primer plano viene de fuera de ese efecto. Publicar la función en
una ref (y vaciarla en el cleanup) es lo que permite que el segundo hable con el primero sin
duplicar el temporizador ni dejar uno vivo tras desmontar.

**Al volver a primer plano se refresca con `eventCoalesceMs` (300 ms), no con los 1,5 s.** Los
1,5 s son para esperar a que el servidor registre una suscripción recién hecha. Volver de
segundo plano no crea ninguna suscripción; si además el canal reconecta, su propio `onStatus`
programa el refetch largo por su cuenta.

### Decisiones sobre la marcha

**Si el socket muere en silencio, se tarda hasta ~30 s en notarlo.** `RealtimeClient` manda un
heartbeat cada 30 s y reconecta si no le contestan. No se ha tocado ese intervalo: bajarlo
gasta batería y datos en todas las sesiones para cubrir un caso que además ya tapan el aviso,
el primer plano y el tirar para refrescar.

**No se fuerza la resuscripción al volver de segundo plano.** Tirar el canal y montar otro
cada vez que el usuario cambia de app es agresivo y añade una ventana de 1,5 s en la que se
pierden eventos. Refrescar la query da el mismo resultado visible y no toca nada que funcione.

**El aviso va debajo de la cabecera, encima de la barra de añadir.** Aparecer y desaparecer
mueve el contenido igual en cualquier sitio; ahí al menos no empuja la acción principal ni la
lista, que son las dos zonas donde el usuario tiene el dedo.

### Cómo probarlo

Con un dispositivo basta para este incremento:

1. Abre la lista con red. **No debe salir ningún aviso** en ningún momento (el estado pasa a
   `connected` antes de los 2 s de gracia).
2. Activa el modo avión con la lista abierta. A los pocos segundos aparece "Los cambios de los
   demás no llegan solos…". Sigue pudiendo leerse la lista.
3. Quita el modo avión sin salir de la pantalla. El aviso se va solo y la lista se refresca.
4. Con red buena, manda la app a segundo plano, cambia algo desde otro dispositivo, y vuelve.
   La lista debe estar actualizada **sin tirar para refrescar**.
5. Con TalkBack: al aparecer el aviso debe leerse la frase entera, sin deletrear el símbolo.
6. Entra y sal de la lista varias veces seguidas: no debe verse ningún parpadeo del aviso.

### Verificado

- `eslint`: 0 errores
- `tsc --noEmit`: limpio
- `jest`: 88 tests
- `npx expo export --platform android`: compila, bundle 5,31 MB
- **En dispositivo: los seis pasos de arriba, correctos**

### Deuda que se asume aquí

- **`RealtimeStatus` y `useAppForeground` no tienen test.** Son UI y suscripción a una API
  nativa; el proyecto no persigue cobertura ahí y montar el entorno para esto no compensa.
- **El estado `disconnected` no distingue "canal caído" de "sin internet".** El texto está
  redactado para valer en los dos casos, pero cuando haya cola offline (Fase 4) merecerá la
  pena separarlos.
- **El heartbeat de 30 s es el peor caso de detección.** Documentado arriba, no medido en el
  dispositivo real.

---

## Incremento 4 · Presencia

Quién más tiene la lista abierta ahora mismo. Es lo que convierte "la lista se actualiza sola"
en "estamos los dos aquí": ver "Ana está viendo la lista" mientras aparecen artículos explica
de dónde salen sin que nadie tenga que contarlo.

| Fichero | Qué hace |
|---|---|
| `community/domain/presence-repository.ts` | El puerto: `watch()` |
| `community/domain/viewers.ts` | Quién se enseña y cuántos caben |
| `community/data/supabase-presence-repository.ts` | El canal de presencia de Supabase |
| `community/presentation/use-viewers.ts` | Suscripción mientras la pantalla vive |
| `community/presentation/ViewersLine.tsx` | La línea de texto |
| `items/presentation/ItemsScreen.tsx` | Dos líneas para engancharlo |
| `shared/lib/i18n/es.json` | `list.viewers.*` |

### Presencia es de `community`, no de `items`

Se pinta en la pantalla de la lista, pero lo que responde es "quién está en esta comunidad
ahora", no "quién mira estos artículos". Si mañana hay una pantalla de miembros o el reparto de
gastos de la Fase 6, la misma pieza vale sin tocar nada.

Mismo puerto y adaptador que el resto:

```ts
watch(
  input: { communityId: string; username: string },
  onChange: (usernames: string[]) => void,
): () => void
```

El puerto habla de nombres, no de `presenceState()` ni de metadatos. El adaptador aplana el
estado de Supabase, descarta entradas sin nombre y deduplica a quien tenga dos dispositivos
abiertos. Que el dominio reciba `string[]` es lo que permite que `viewers.ts` sean funciones
puras con tests de milisegundos.

### El estado de presencia no va en Query ni en Zustand

Es la tercera categoría, y conviene dejarla escrita porque `CLAUDE.md` solo nombra dos.

No es server state en el sentido de Query: no se lee, no se invalida, no se cachea, no
sobrevive a cerrar la pantalla y no tiene sentido persistirlo. Un `useQuery` sin `queryFn`
utilizable es forzar la herramienta. Tampoco es client state compartido: solo lo usa la
pantalla que lo mira, así que un store de Zustand solo añadiría ceremonia y un estado global
que hay que acordarse de limpiar.

`useState` dentro del hook, muere con la pantalla. La regla que sigue en pie es la de siempre:
**no duplicar en un store nada que venga del servidor**, y esto no viene de ninguna tabla.

### Canal aparte, y por qué no molesta

`presence:<communityId>`, separado del `items:<communityId>` del incremento 2. Un canal de
Supabase es un topic multiplexado sobre el **mismo websocket**, así que dos canales no son dos
conexiones: no hay coste de red que justifique mezclarlos. Y mezclarlos sí tendría coste, el de
atar el ciclo de vida de las dos cosas: hoy la lista está en `items` y la presencia en
`community`, y un canal compartido obligaría a que una feature dependiera de la otra.

### Tres trampas de la API de presencia, las tres encontradas en ejecución

**1. La presencia viene desactivada aunque la configures.** El canal solo anuncia
`presence_enabled` al servidor si tiene un binding de `presence` **o** si lleva
`config.presence.enabled === true` (`RealtimeChannel.js`, en el payload del join). Pasar solo
`config.presence.key` no basta: `track()` resuelve sin error y `presenceState()` devuelve `{}`
para siempre. Un fallo silencioso y sin mensaje.

El adaptador pone las dos cosas, `enabled: true` y el `.on('presence', ...)`, aunque con una
bastaría. Depender de que exista el listener significa que quitar el listener rompe la
funcionalidad de una forma que no se parece en nada a la causa.

**2. Dos personas que entran a la vez no se ven.** Es la misma ventana de ~1 s del incremento
1, ahora desde el otro lado: si B se suscribe justo mientras A hace su `track`, el diff de A
sale antes de que B esté registrado y el snapshot inicial de B llega vacío. Resultado real del
test: A veía `[ana, carla]` y C solo `[carla]`.

Se arregla repitiendo el `track()` una vez pasados 2 s. Un `track` repetido con la misma clave
es idempotente en el estado (mismo `key`, mismos metadatos) y genera un diff nuevo que sí
alcanza a quien llegó tarde. Alternativa descartada: pedir el estado al servidor cada N
segundos, que es un sondeo con un coste permanente para arreglar un problema de dos segundos.

**3. Cerrar el canal no te da de baja a tiempo.** `removeChannel()` a secas dejaba a quien se
iba apareciendo como presente en la pantalla de los demás. La comprobación "Al cerrar la lista
se deja de aparecer" falló en la primera versión. Hay que llamar a `untrack()` **antes**.

Y hay que llamarlo **sin esperarlo**. `RealtimeChannel.send()`, para cualquier tipo que no sea
broadcast, devuelve una promesa que espera el `ok` del servidor con timeout de 10 s por
defecto. Un `await channel.untrack()` dentro del cleanup de un `useEffect` no es opción: el
cleanup es síncrono, y sin red esa promesa tardaría diez segundos en resolverse. Se lanza y se
sigue:

```ts
void channel.untrack()
void supabase.removeChannel(channel)
```

Los dos mensajes se empujan al mismo socket en orden, así que el `untrack` sale primero aunque
nadie espere su respuesta. Verificado contra el backend real: 12/12 con esta forma, igual que
con `await`.

### Qué se enseña

`ViewersLine` devuelve `null` cuando no hay nadie más. Un "no hay nadie viendo la lista"
permanente es ruido, y además sería mentira a los pocos segundos.

- Te quitas a ti mismo (`othersViewing`). Que la app te diga que tú estás mirando es absurdo.
- Nombres **ordenados alfabéticamente**. Sin orden estable, cada `sync` puede reordenar el
  texto y la línea baila sola en pantalla.
- Máximo tres nombres, el resto como "y otras N personas". Una lista de nueve nombres en un
  móvil ocupa tres líneas y no dice nada que no diga el número.
- Plurales por i18n (`viewing_one` / `viewing_other`, `andMore_one` / `andMore_other`), no
  concatenando cadenas. Al pasar a inglés esto no se toca.

`accessibilityLiveRegion="polite"`: se anuncia cuando alguien entra o sale, sin cortar lo que
el lector esté leyendo.

### Test nuevo en `npm run test:realtime`

Dos comprobaciones más, con los dos miembros reales de la misma lista que ya montaba el
incremento 2:

```
OK   Cada uno ve quién más tiene la lista abierta — A ve [ana,carla] · C ve [ana,carla]
OK   Al cerrar la lista se deja de aparecer — A ve [ana]
```

12/12. Las tres trampas de arriba las encontró este test, no el móvil: en pantalla el síntoma
de las tres es el mismo, no sale nadie, y con un solo dispositivo no se distingue de "estoy
solo".

### Seguridad: la presencia no la protege RLS

Importa dejarlo escrito porque es la primera cosa de la app que no pasa por una política.

Los canales de Realtime se autorizan por token, pero **el contenido de un `track()` no lo
valida nadie**: el nombre que se anuncia es el que el cliente diga. Lo único que impide
aparecer en la lista de una comunidad ajena es no conocer su uuid, que no es público (para
saberlo hay que ser miembro, porque la política de `communities` no deja leerlo de otra forma).
Es el mismo modelo que el `join_code`: un secreto compartido, no una identidad verificada.

Para lo que hace esto —enseñar "Ana está viendo la lista"— es suficiente: el peor caso es que
alguien que ya está dentro se anuncie con otro nombre, y ya podía hacerlo al unirse. Deja de
ser suficiente en cuanto un dato dependa de quién dice ser cada uno, que es exactamente el
problema del reparto de gastos: ver [ADR-0005](../adr/ADR-0005-reparto-de-gastos.md), que
condiciona su Fase 6 a tener identidad no suplantable.

### Decisiones sobre la marcha

**La clave de presencia es el nombre de usuario, no el `auth_user_id`.** Es único dentro de la
comunidad (`unique (community_id, username)`), que es justo el ámbito del canal, y es lo que
hay que pintar. Usar el uid obligaría a resolver uid → nombre con una lectura extra para
enseñar la línea.

Efecto lateral aceptado: la misma persona con dos dispositivos comparte clave, así que sus dos
entradas se agrupan solas. Se cuenta una vez, que es lo que el usuario espera. Hay un test
para eso.

**Si el canal se cae, la lista se vacía.** No se congela el último valor conocido. Enseñar que
alguien está mirando cuando hace rato que no se sabe nada es peor que no enseñar nada, y la
línea desaparece sin dejar hueco.

**`setPresent([])` al cambiar de comunidad.** Sin eso, al salir de una lista y entrar en otra se
verían un instante los nombres de la anterior.

### Cómo probarlo

Automático:

```bash
npm run test:realtime    # 12/12
npm test                 # 104 tests
```

A mano, con **dos dispositivos**:

1. Entra en la misma lista desde A (como "ana") y desde B (como "luis").
2. En A debe aparecer "luis está viendo la lista" en unos segundos. En B, "ana está viendo la
   lista". **Ninguno se ve a sí mismo.**
3. Sal de la lista en B (botón de salir, o cierra la app). En A la línea desaparece en unos
   segundos.
4. Vuelve a entrar en B. La línea reaparece en A.
5. Entra desde un tercer dispositivo, o desde el emulador, con otro nombre. La línea debe
   nombrar a los dos, en orden alfabético.
6. Modo avión en B con la lista abierta: en A desaparece de la línea al poco. Al quitar el modo
   avión vuelve a aparecer solo.
7. Con TalkBack en A: al entrar B, el cambio se anuncia sin cortar lo que se esté leyendo.

El paso 2 es el que valida la corrección de las entradas simultáneas: si entras en las dos
casi a la vez y solo uno ve al otro, el re-`track` de los 2 s no está funcionando.

### Verificado

- `eslint`: 0 errores
- `tsc --noEmit`: limpio
- `jest`: 104 tests (88 + 7 de `viewers` + 8 del adaptador de presencia, +1 al cubrir el
  re-`track`)
- `grep` de frontera: `domain/` sin imports de React, Supabase, Query, Zustand ni Expo
- `npm run test:realtime`: 12/12
- `npm run test:rls`: 13/13, sin moverse
- `npx expo export --platform android`: compila, bundle 5,31 MB
- **En dispositivo (dos Android): los siete pasos de arriba, correctos.** Incluida la entrada
  casi simultánea, que es la que valida el re-`track` de los 2 s.

### Deuda que se asume aquí

- **El nombre anunciado no está verificado por el servidor.** Ver arriba. Bloquea la Fase 6
  tal y como la plantea el ADR-0005, no esta.
- **`use-viewers.ts` y `ViewersLine.tsx` no tienen test.** Misma razón que en el incremento 3:
  el proyecto no tiene entorno de test de hooks con React. Lo puro y lo del adaptador sí están
  cubiertos.
- **El re-`track` de 2 s es un número elegido a ojo**, calibrado con la misma ventana que se
  midió en el incremento 1. Si un día se ven entradas simultáneas que no se detectan, es el
  primer sitio donde mirar.
- **Nadie limpia una presencia fantasma.** Si un móvil se queda sin batería, el servidor tarda
  en tirar la conexión y ese nombre sigue en la lista hasta entonces. Es comportamiento de
  Phoenix Presence y no se controla desde el cliente.

---

## Incremento 5 · Saber qué versión corre en el móvil

No estaba planificado. Salió al entregar la fase a los dos dispositivos: se publicó el update,
los móviles seguían enseñando lo de antes, y **no había forma de distinguir** "el update no ha
llegado" de "ha llegado y esto es lo que hace". Media hora de diagnóstico a ciegas por no tener
un dato que cuesta diez líneas.

| Fichero | Qué hace |
|---|---|
| `shared/lib/build-info.ts` | Lee versión y update actual |
| `shared/ui/BuildTag.tsx` | La línea, al pie de la lista |
| `shared/lib/i18n/es.json` | `build.*` |

```
v1.0.0 · base        → corriendo el bundle que venía dentro del APK
v1.0.0 · 019fc47f    → corriendo el update 019fc47f
```

`Updates.isEmbeddedLaunch` es lo que separa los dos casos, y es el que importa: `updateId` a
secas no vale, porque en un arranque embebido puede traer el id del bundle incrustado y parecer
que hay un update aplicado cuando no lo hay.

Ocho caracteres del id bastan para casarlo con la salida de `eas update`, que imprime el id
entero. Nadie va a teclearlo: se lee y se compara.

Va al pie del todo, bajo el botón de salir, en `text-xs` y color `muted`. No es información
para el usuario y no debe competir con nada; está para que quien prueba pueda mirarla, y para
poder preguntar por teléfono "¿qué pone abajo del todo?".

`accessibilityLabel` aparte del texto visible: el lector de pantalla lee "Versión 1.0.0,
actualización 0 1 9 f c 4 7 f", con el id deletreado. Leído del tirón es ruido; deletreado se
puede transcribir.

### Decisiones sobre la marcha

**En `shared/`, no en `items`.** No tiene nada que ver con artículos. Hoy se pinta en la lista
porque es donde se pasa el tiempo probando; cuando haya más pantallas, se mueve o se duplica sin
tocar nada.

**Sin test.** Es una lectura de dos constantes de módulos nativos y un `Text`. Mockear
`expo-updates` para comprobar que un `if` elige entre dos cadenas de i18n no aporta.

**No se enseña el canal ni el runtime version.** Se pensó y se descartó: el canal ya se sabe por
qué APK tienes instalado, y el runtime es la versión. Más texto para el mismo diagnóstico.

### Cómo probarlo

En Expo Go y en desarrollo pone `base`, porque no hay update aplicado. La comprobación de verdad
es sobre el APK: publica un update, entra en la lista y mira el pie. Debe coincidir con el
`Update group ID` que imprimió `eas update`.

---

## Auditoría de cierre (§11 del documento maestro)

Solo se revisan los apartados que esta fase toca. Los demás se auditan en la suya.

### B. Arquitectura

- [x] **El dominio no importa nada de Supabase/React.** `grep -rE "from '(react|@supabase|@tanstack|zustand|expo)" src/features/*/domain/` → cero resultados. La fase añadió cuatro ficheros a `domain/` (`visible-items.ts`, `presence-repository.ts`, `viewers.ts`, y el `subscribe` del puerto de items) y ninguno cruza la frontera.
- [x] **Interfaz `Repository` + adaptador.** Las dos capacidades nuevas entraron como puertos: `ItemRepository.subscribe()` y `PresenceRepository`. Cambiar de proveedor de Realtime toca `data/` y nada más. La tentación era montar el canal en el `useEffect` de la pantalla, que es como lo enseñaba la propia skill; se corrigió.
- [x] **Server state solo en Query, client state solo en Zustand, sin duplicación.** El cambio grande de la fase va justo en esa dirección: el borrado con deshacer dejó de esconder filas quitándolas de la caché y pasó a marcar ids en Zustand, con la caché reflejando siempre lo que hay en el servidor. La presencia abrió una tercera categoría (`useState` local, ni server ni client compartido) y está razonada en el incremento 4.

### D. Datos y sincronización

- [x] **Realtime propaga entre dos redes distintas en < 2 s.** `npm run test:realtime` da 12/12 con tres sesiones anónimas independientes, y las esperas del script son de 1,5–2,5 s: si tardase más de eso, fallaría. **Confirmado además con dos Android reales** ejecutando el APK de `preview`, con los nueve pasos de la lista de prueba.
- [ ] **Offline: abre sin red y encola cambios.** No es de esta fase. La caché persistente y la cola son Fase 4. Hoy la app sin red lee lo que tenga en memoria, avisa con `errors.offline` y no encola nada.
- [x] **Optimistic UI con rollback.** Ya estaba de la Fase 1 y esta fase lo tensó: la guarda de `isMutating()` existe justo porque tu propio evento de Realtime llegaba en mitad de una escritura optimista.
- [ ] **Lista de 200 ítems fluida.** No medido. Los índices están desde la Fase 0 y la lista es una `SectionList` virtualizada, pero nadie ha probado con 200. Queda para la Fase 4.

### Lo que se verificó de paso

- **G. Calidad de código:** lint y typecheck en cero errores; 104 tests; cobertura de `domain/` y `data/` al **97,3 %** de sentencias y 92,5 % de ramas, muy por encima del 70 % exigido. Cada incremento tiene su entrada aquí con el qué, el por qué y cómo probarlo.
- **E. Seguridad:** `npm run test:rls` sigue en 13/13 después de todos los cambios. La única cosa nueva que no pasa por RLS es la presencia, documentada arriba con su límite y su consecuencia para la Fase 6.

### La prueba en dispositivo

Hecha, con **dos Android reales** corriendo el APK del perfil `preview` actualizado por aire.
Los nueve pasos correctos, incluidos los tres que no se pueden automatizar y que eran los que de
verdad decidían si la fase estaba terminada:

- **Borrar y deshacer con otra persona escribiendo a la vez** (paso 5): aparece lo del otro sin
  que reaparezca el borrado. Es el caso que rompía antes de mover el estado de borrado a Zustand.
- **Entrada casi simultánea** (paso 2): los dos se ven. Valida el re-`track` de los 2 s.
- **Modo avión y vuelta** (paso 7) y **segundo plano** (paso 8): el aviso aparece, se va solo y
  la lista se refresca sin tirar hacia abajo.

Que esto no se pueda validar con un solo móvil es la razón de que el script de Realtime cubra
tanto: los tres fallos silenciosos de la presencia se encontraron ahí, no en pantalla, porque
en el móvil los tres se ven igual —no aparece nadie— y eso es indistinguible de estar solo.

### Cómo se entregó

Update por aire al canal `preview` (`eas update --branch preview`), sin build nuevo: la fase no
añadió ni una dependencia nativa, solo un script de npm. Dos cosas que costaron rato y quedan
anotadas en `docs/guias/despliegue.md`:

- `eas update` exporta con `--platform=all`, y sin array `platforms` en `app.json` eso incluye
  web, que este proyecto no soporta. El export fallaba antes de subir nada.
- Un update se descarga en un arranque y se aplica en el **siguiente**, y deslizar la app en
  recientes no mata el proceso en muchas capas de Android. Hace falta forzar detención.

De ahí salió el incremento 5.
