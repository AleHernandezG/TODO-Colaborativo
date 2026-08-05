# Fase 5 · Endurecimiento antes de publicar

- Estado: **abierta**. Incrementos 1, 2 y 3 escritos y verdes en local (la migración del 2 ya está
  aplicada en el proyecto remoto); los tres siguen pendientes de probar en dispositivo. Queda el
  incremento 4 (TalkBack), que es prueba manual entera
- Inicio: 2026-08-05
- Luz verde del usuario: 2026-08-05, con el MVP (fases 0 → 4) ya cerrado

Esta fase no está en el roadmap original. Existe porque el cierre de las fases 3 y 4 dejó cosas
apuntadas «para antes de publicar», y publicar sin recorrerlas sería tirar el trabajo de haberlas
apuntado.

## Alcance, decidido con el usuario

Se eligió el paquete **mínimo para publicar**. Cuatro incrementos:

1. [x] **Id del artículo generado en el cliente.** Cierra la deuda de la Fase 4: un artículo
       añadido sin cobertura y tocado en esa misma sesión perdía el segundo cambio sin avisar.
2. [x] **Expiración y rotación del `join_code`.** El código es el único secreto que protege una
       lista y hasta ahora no caducaba nunca.
3. [x] **i18n en inglés.** La estructura está desde la Fase 0; faltaba el `en.json` y la detección
       del idioma del sistema.
4. [ ] **La pasada con TalkBack.** Es el criterio F.2 de la Fase 3, aplazado por decisión el
       2026-08-05. Guion en el bloque 4 de `docs/guias/prueba-de-cierre-en-dispositivo.md`.

**Lo que queda fuera, y se decidió que quedara fuera:** PIN por miembro, Sentry, notificaciones
push, roles dentro de la comunidad, analítica y pasar a development build. Ninguna es necesaria
para una beta que se prueba entre gente conocida, y varias (Sentry, development build) cambiarían
el flujo de trabajo de todo el proyecto, que hoy es Expo Go + `eas update`.

---

## Incremento 1 · El id del artículo lo pone el cliente

La deuda que cerró esta fase estaba contada entera en `fase-4.md` y en las consecuencias de
[ADR-0009](../adr/ADR-0009-cola-de-mutaciones-offline.md): sin cobertura, añadir «pan» y marcarlo
como comprado a continuación mandaba el alta con un id inventado (`optimistic-<ts>`) y la marca
contra ese mismo id inventado. El alta llegaba y creaba la fila con otro uuid; la marca hacía
`update ... where id = 'optimistic-…'`, afectaba a cero filas y **no daba error**.

El porqué de la solución, con las alternativas descartadas, en
[ADR-0010](../adr/ADR-0010-id-del-articulo-generado-en-el-cliente.md).

| Fichero                                           | Qué hace                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `shared/lib/uuid.ts`                              | Nuevo. `randomUuid()` sobre el `uuid.v4()` de `expo-modules-core`                |
| `features/items/domain/item-repository.ts`        | `add` recibe `id`                                                                |
| `features/items/domain/add-item.ts`               | Lo pasa al repositorio sin tocarlo                                               |
| `features/items/data/supabase-item-repository.ts` | Inserta el `id` y trata el `23505` como «ya estaba»                              |
| `features/items/presentation/item-mutations.ts`   | `AddItemVariables` lleva `id`                                                    |
| `features/items/presentation/use-add-item.ts`     | Genera el uuid al llamar a `mutate`, no en `onMutate`                            |
| `jest.setup.js`                                   | `globalThis.expo.uuidv4` para que el uuid nativo tenga con qué responder en Node |
| `package.json`                                    | `expo-modules-core` pasa a dependencia declarada, fijada en `3.0.30`             |

### Sin build nuevo, y esa fue la razón de elegir este uuid

`expo-modules-core` ya está dentro del APK 1.2.0: es el core de cualquier app de Expo, no un
paquete que se añade. Se comprobó en el propio `node_modules`, sin necesidad del móvil:
`CoreModule.kt` registra `Function("uuidv4")` y por debajo llama a `UUID.randomUUID()` de Java, que
va con `SecureRandom`. Así que este incremento es JavaScript puro y viaja en un `eas update`, sin
generar una 1.2.1.

Se declara en `package.json` con la versión exacta que ya estaba instalada. Antes venía de rebote
como dependencia de `expo`, y depender de algo que no has pedido funciona hasta que un `npm dedupe`
lo mueve de sitio.

### El id nace en `mutate`, no en `onMutate`

```ts
mutate: (input: { name: string; quantity: number }) =>
  mutation.mutate({ ...input, id: randomUuid(), communityId }),
```

Es lo único de este incremento que se puede escribir mal sin que nada se queje: en `onMutate` el id
existiría en la caché y en el closure, pero **no en las `variables`**, y las `variables` son lo
único que se guarda en disco de una mutación en pausa. Al reiniciar la app, la mutación rehidratada
insertaría un id distinto del que la pantalla enseña. Hay un test que lo fija: encola un alta y una
marca sobre el mismo id, deshidrata, rehidrata en otro cliente y comprueba que al reanudar el
`setPurchased` va contra el id que insertó el `add`.

### Cómo probarlo a mano

Es el guion que hasta hoy había que **evitar**, y ahora tiene que pasar. Un solo móvil hasta el
último paso.

1. Publica el update y comprueba al pie de la lista que pone `v1.2.0 · <id>`, no `· base`.
2. Modo avión.
3. Añade un artículo nuevo, «pan».
4. Sin salir del modo avión, **márcalo como comprado**. Baja a «Comprados».
5. Vuelve a abrirlo y cámbiale la cantidad a 3.
6. Cierra la app del todo (recientes → deslizar). Sigue en avión.
7. Ábrela: sigue «pan», marcado y con cantidad 3, y el aviso de cambios pendientes.
8. Quita el modo avión. El aviso desaparece.
9. **En el segundo móvil**: aparece «pan», marcado como comprado y con cantidad 3.

Si en el paso 9 aparece «pan» sin marcar y con cantidad 1, el id no está viajando en las
`variables` y hay que mirar el punto anterior.

Prueba corta de que no se rompió lo de siempre: con red, añadir un artículo tiene que seguir
apareciendo al instante y quedarse (si parpadea o se duplica al llegar el evento de Realtime, el id
optimista y el de la fila no coinciden).

### Calidad

| Comprobación                         | Resultado                                                   |
| ------------------------------------ | ----------------------------------------------------------- |
| `npm run lint`                       | limpio                                                      |
| `npm run typecheck`                  | limpio                                                      |
| `npm test`                           | 163 tests, 24 suites, todo en verde                         |
| `npm run test:coverage`              | por encima del umbral; `supabase-item-repository.ts` al 98% |
| `npx expo export --platform android` | bundle generado, 5.45 MB                                    |

Tests nuevos: los dos caminos del `23505` en el adaptador (el artículo sigue ahí → lo devuelve; ya
no está → falla en vez de inventárselo), el id que sobrevive a deshidratar y rehidratar junto a una
marca posterior, y el formato del uuid en `shared/lib/__tests__/uuid.test.ts`.

### Decisiones sobre la marcha

**El dominio no valida el id.** `addItem` lo pasa tal cual al repositorio, sin comprobar que sea un
uuid. El id no lo escribe nadie, lo genera nuestro propio código; añadir un `invalid_id` al
resultado obligaría a la pantalla a manejar un caso que solo puede darse si el generador está roto,
y eso ya lo cubre el test de `randomUuid`. Si algún día el id llegara de fuera (un import, un
deep link), esta decisión cambia.

**El mock del uuid en Jest se pone en `globalThis`, no mockeando el módulo.** `uuid.v4()` de
`expo-modules-core` llama a `globalThis.expo.uuidv4`, que en Node no existe y lanza. Se le da un
`randomUUID()` de `node:crypto` en `jest.setup.js` en vez de un `jest.mock('expo-modules-core')`
porque así el test ejecuta el código real del módulo y comprobamos la forma del export que estamos
usando, que es justo lo que da algo de reparo de este camino.

**Ojo con publicar un update cuando alguien tenga cambios sin sincronizar.** No es de este
incremento, pero se vio mirando `query-persister.ts` y no estaba escrito con todas las letras: el
`buster` incluye el `updateId`, así que **un `eas update` descarta la caché persistida entera,
incluidas las mutaciones en pausa**. Quien tenga la app cerrada con la cola llena y reciba el
update pierde esos cambios sin aviso. Es la contrapartida buscada (rehidratar una cola con otra
forma sería peor), pero conviene publicar updates cuando no haya nadie a medias, y no publicar
justo después de decirle a alguien que pruebe el modo avión.

---

## Incremento 2 · Expiración y rotación del `join_code`

El `join_code` era eterno e inmutable: quien lo tuvo alguna vez entraba siempre. Ahora caduca a los
7 días y cualquier miembro puede generar uno nuevo, que mata al anterior en el acto.

El porqué de cada pieza, con las alternativas descartadas, en
[ADR-0011](../adr/ADR-0011-caducidad-y-rotacion-del-join-code.md).

### Las tres decisiones de producto, y quién las tomó

Las eligió el usuario antes de escribir una línea de SQL:

| Pregunta                             | Respuesta                                        |
| ------------------------------------ | ------------------------------------------------ |
| ¿Cuándo caduca?                      | A los 7 días                                     |
| Al rotar, ¿qué pasa con el anterior? | Deja de valer al instante, sin periodo de gracia |
| ¿Quién puede rotar?                  | Cualquier miembro                                |

### El esquema

Migración `20260805120000_join_code_expiry.sql`, con el diseño enseñado y aprobado antes de
escribirla:

- `join_code_lifetime()`, función `immutable` que devuelve `interval '7 days'`. El plazo se escribe
  una vez y lo usan los dos sitios que lo necesitan.
- `communities.join_code_expires_at timestamptz not null default now() + join_code_lifetime()`. La
  expresión es estable, así que Postgres la evalúa **una vez** al aplicar la migración: las listas
  que ya existían arrancan con 7 días desde ese momento.
- `join_community` gana el estado `expired_join_code`, y ese fallo **cuenta en `join_attempts`**
  igual que un código inexistente (si no contara, dar con un código vencido sería una forma gratis
  de saber que esa lista existe).
- `rotate_join_code(p_community_id uuid) returns table (join_code text, expires_at timestamptz)`,
  `security definer`, que empieza comprobando `p_community_id in (select member_community_ids())` y
  lanza `not_a_member` si no. Genera el código con `generate_join_code()`, que ya reintenta hasta
  encontrar uno libre.
- Los `revoke ... from public, anon` + `grant ... to authenticated` de rigor. `join_code_lifetime()`
  no recibe grant: solo la llaman el `default` de la columna y `rotate_join_code`, y ambos se
  evalúan con privilegios del dueño.

No hace falta índice nuevo: nadie filtra por `join_code_expires_at`, se lee siempre por `id` o por
`join_code`, que ya son únicos.

### En la app

| Fichero                                                    | Qué hace                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `community/domain/community.ts`                            | Nuevo tipo `JoinCodeInfo { code, expiresAt }`                                                                |
| `community/domain/join-code.ts`                            | `joinCodeExpiry(expiresAt, now)` → `expired` o `valid` con `daysLeft`                                        |
| `community/domain/community-repository.ts`                 | `getJoinCode` y `rotateJoinCode` en el puerto; `expired_join_code` en `JoinOutcome`                          |
| `community/domain/get-join-code.ts`, `rotate-join-code.ts` | Casos de uso                                                                                                 |
| `community/data/supabase-community-repository.ts`          | Lee `join_code, join_code_expires_at` y llama a la RPC                                                       |
| `community/presentation/use-join-code.ts`                  | Query `['join-code', communityId]`, persistida                                                               |
| `community/presentation/use-rotate-join-code.ts`           | Mutación no optimista, `networkMode: 'always'`, escribe la respuesta con `setQueryData`                      |
| `community/presentation/JoinCodeCard.tsx`                  | Deja de recibir el código por props: lo pide. Línea de caducidad, botón de generar y diálogo de confirmación |
| `community/presentation/JoinCommunityScreen.tsx`           | Mensaje propio para el código caducado                                                                       |
| `items/presentation/ItemsScreen.tsx`                       | Le pasa `communityId` a la tarjeta                                                                           |
| `scripts/rls-isolation-test.mjs`                           | Cinco comprobaciones nuevas                                                                                  |

### El código deja de vivir en Zustand

Era un campo de `Community` dentro del store persistido, copiado al crear o entrar en la lista.
En cuanto el código puede cambiar desde otro móvil, esa copia es server state duplicado en el
cliente, que es de las pocas cosas que `CLAUDE.md` prohíbe por escrito. Ahora es una query.

`Community.joinCode` se queda en el tipo y en el store, sin usarse para pintar: quitarlo obligaría
a migrar el estado ya guardado en los móviles que tienen la app puesta, a cambio de nada. Si un día
se toca la forma del store por otro motivo, ese es el momento de borrarlo.

### Cómo se entera el otro móvil, y por qué no con `focusManager`

`communities` no está en la publicación de Realtime, así que una rotación no se propaga sola: el
móvil de al lado sigue enseñando el código viejo hasta que vuelva a preguntar.

El primer intento fue enganchar el `focusManager` de Query a `AppState` en `query-client.ts`, que es
la forma «de manual» de que todo refresque al volver del segundo plano. Se descartó al ver que este
proyecto ya resuelve eso por otro camino: `useAppForeground` (`shared/hooks`), que `useItemsRealtime`
usa para refrescar la lista al volver, con su coalescing y su comprobación de mutaciones en vuelo.
Un `focusManager` global se solaparía con eso y dispararía dos refetch de la lista con 300 ms de
diferencia, uno por cada mecanismo. Un mecanismo por cosa, y el que ya está.

Así que el refresco lo pide la query del código, en su propio hook:

```ts
useAppForeground(
  useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: joinCodeKey(communityId) })
  }, [queryClient, communityId]),
)
```

Sin red no pasa nada malo: la query queda en `paused` en vez de fallar, porque `onlineManager` ya
sabe que no hay conexión.

### Cómo probarlo a mano

Necesita los dos móviles. A = el que crea, B = el que se une.

1. **A**: crea una lista nueva. Al pie tiene que poner «Caduca dentro de 6 días» (6 y no 7: quedan
   6 días y pico, y se redondea hacia abajo a propósito, que prometer 7 el último día es mentir).
2. **B**: entra con ese código. Todo normal.
3. **A**: pulsa «Generar código nuevo». Sale el diálogo de confirmación; cancela. El código no
   cambia.
4. **A**: pulsa otra vez y confirma. El código cambia, el snackbar lo dice y la caducidad vuelve a
   empezar.
5. **B**: sigue dentro de la lista sin enterarse de nada. Rotar no expulsa a nadie.
6. **En un tercer móvil o reinstalando**: entra con el código **viejo**. Tiene que decir «Ese
   código no existe. Revísalo y vuelve a intentarlo.» bajo el campo.
7. Entra con el nuevo: funciona.
8. **A en modo avión**: pulsa «Generar código nuevo» y confirma. Tiene que avisar de que no hay
   conexión y **no** quedarse el cambio pendiente para luego. El código sigue siendo el mismo al
   volver la red.
9. **B con la app abierta en la lista**, manda la app al segundo plano, **A rota el código**, B
   vuelve a la app: al cabo de un momento B enseña el código nuevo (esto es `useAppForeground`; sin
   él habría que tirar hacia abajo).

### Decisiones sobre la marcha

**Leer el código es un `select`, no una RPC.** `communities_select` ya deja a un miembro leer su
propia comunidad, así que `getJoinCode` hace `select join_code, join_code_expires_at ... eq(id)` y
se acabó. Una RPC solo hace falta cuando hay que saltarse RLS (entrar sin ser miembro todavía) o
escribir en una tabla sin política de escritura (rotar). Añadir una aquí sería ceremonia.

**Los días se redondean hacia abajo.** `joinCodeExpiry` devuelve `Math.floor` de lo que queda, así
que un código con 6 días y 23 horas dice «caduca dentro de 6 días». Prometer 7 el último día es la
clase de detalle que hace que alguien reparta el código pensando que le sobra un día.

**Un código caducado deshabilita copiar y compartir**, y el botón de generar pasa a primario. Dejar
copiar un código muerto es dejar que el usuario haga el ridículo en el grupo de WhatsApp. El código
sigue en pantalla, tachado, para que se entienda qué pasó.

**El error de rotar no distingue `not_a_member`.** La RPC lo lanza como excepción y en la app cae
en el mensaje genérico de «no se pudo generar un código nuevo». Es un caso que no puede pasar desde
la UI (el botón solo existe dentro de tu lista) y que solo se vería atacando la API a mano, que es
justo lo que comprueba `test:rls`.

**El test de aislamiento necesita cuatro sesiones anónimas, no dos.** La tercera (C) hace de miembro
normal para probar que cualquiera puede rotar, y la cuarta (D) prueba el código viejo: A ya está
consumida por el bucle del rate limit y no sirve para comprobar nada que dependa de `join_community`.

### Calidad

| Comprobación                         | Resultado                           |
| ------------------------------------ | ----------------------------------- |
| `npm run lint`                       | limpio                              |
| `npm run typecheck`                  | limpio                              |
| `npm test`                           | 179 tests, 25 suites, todo en verde |
| `npm run test:rls`                   | 24/24                               |
| `npx expo export --platform android` | bundle generado, 5.46 MB            |

La migración se aplicó el 2026-08-05 con `npx supabase db push` y `db.types.ts` se regeneró justo
después. En ese orden y en el mismo cambio: mientras los tipos van por detrás del esquema, el
adaptador no compila (`rotate_join_code` no existe en el tipo de `supabase.rpc`), y eso es una
señal correcta, no una molestia. Lo peligroso es lo contrario, tipos por delante del esquema, que
compila en verde y revienta en el móvil.

El estado «caducado» a mano no se puede ver sin esperar una semana. Lo cubre `npm run test:rls`,
que envejece la fila con la clave secreta y comprueba que `join_community` responde
`expired_join_code`. Si quieres verlo en pantalla, cambia a mano
`join_code_expires_at` de tu lista a una fecha pasada desde el panel de Supabase: la tarjeta pasa a
enseñar el código tachado, «Caducado. Genera uno nuevo para poder invitar.», los botones de copiar
y compartir deshabilitados y el de generar en primario.

---

## Incremento 3 · Inglés

La estructura de i18n está desde la Fase 0 y todas las pantallas se escribieron con `t(...)`, así
que este incremento no tocó ni una pantalla: es traducir, elegir bien el idioma de arranque y
comprobar que el repaso de «cero textos a fuego» era verdad. No lo era del todo, y eso es lo único
interesante que pasó aquí.

| Fichero                                                  | Qué hace                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| `shared/lib/i18n/en.json`                                | Nuevo. Las 159 líneas de `es.json`, mismas claves, mismos plurales   |
| `shared/lib/i18n/resolve-language.ts`                    | Nuevo. Recorre los idiomas del móvil y devuelve el primero soportado |
| `shared/lib/i18n/index.ts`                               | Registra `en` y usa `resolveLanguage`                                |
| `shared/lib/i18n/es.json`                                | Dos claves nuevas para los fallos de arranque de sesión              |
| `features/session/domain/session-error.ts`               | Nuevo. `SessionError` con un `reason` de tres valores                |
| `features/session/data/supabase-session-repository.ts`   | El proveedor anónimo desactivado pasa a ser un `SessionError`        |
| `features/session/presentation/session-store.ts`         | `error` deja de ser `string` y pasa a ser el motivo                  |
| `features/session/presentation/use-session-bootstrap.ts` | Traduce la excepción a motivo                                        |
| `features/session/presentation/SessionGate.tsx`          | Pinta la clave de i18n que corresponde al motivo                     |

### El agujero que encontró el repaso

`SessionGate` pintaba `{error}` tal cual, y ese `error` era el `message` de la excepción que hubiera
salido del arranque de sesión. O sea: **la pantalla de error más temprana de la app, la que ve
alguien la primera vez que la abre, enseñaba una cadena en español escrita a mano en `data/`**. En
un móvil en inglés se veía «No se pudo crear la sesión anónima: …». Y el caso más probable de todos,
abrir la app sin cobertura y sin sesión guardada, enseñaba el `message` de `OfflineError`.

Se arregló como se arregla siempre en este proyecto: el mensaje al usuario no viaja como texto, sino
como estado. El adaptador sigue lanzando excepciones con su detalle en español (que es para el log y
para quien depura, no para la pantalla) y la presentación decide qué se lee.

```ts
function reasonOf(cause: unknown): SessionErrorReason {
  if (cause instanceof OfflineError) return 'offline'
  if (cause instanceof SessionError) return cause.reason
  return 'unknown'
}
```

Tres motivos y no más: `offline` reutiliza `errors.offline`, `anonymous_disabled` mantiene la
instrucción de arreglo (es la que desbloquea a quien clona el repo y no ha activado el proveedor
anónimo, ver `fase-0.md`), y `unknown` para todo lo demás. Un motivo por mensaje que de verdad
cambia lo que el usuario puede hacer; los otros ocho `throw` del adaptador de sesión y de items
caen en `unknown` a propósito, porque para el usuario todos significan lo mismo.

### Por qué la detección del idioma no es una línea

Antes era esto:

```ts
const deviceLanguage = getLocales()[0]?.languageCode ?? 'es'
lng: deviceLanguage in resources ? deviceLanguage : 'es'
```

Mira solo el primer idioma de la lista y compara la cadena cruda contra las claves de `resources`.
Con un `en-GB` o un `EN` no hay coincidencia y el usuario acaba en español sin motivo. `getLocales()`
devuelve **las preferencias ordenadas** del sistema, así que alguien con francés primero e inglés
segundo tiene que ver inglés, no español.

`resolveLanguage` vive en su propio fichero y no importa `expo-localization`: recibe un array de
códigos y devuelve un idioma soportado. Así se prueba en Node sin mockear el módulo nativo, que es
la diferencia entre tener test y no tenerlo.

### El test que evita el fallo típico de tener dos idiomas

`__tests__/translations.test.ts` compara los dos JSON y falla si:

- una clave existe en uno y no en el otro
- un valor está vacío
- los `{{placeholders}}` de una clave no coinciden entre idiomas (traducir
  `«Marcar {{name}} como comprado»` y perder el `{{name}}` deja un texto que no dice qué artículo es)
- una clave tiene `_one` sin `_other`, o al revés, en cualquiera de los dos

Es la clase de fallo que no rompe nada al compilar y aparece en el móvil de otra persona.

### Cómo probarlo a mano

Con un solo móvil, sin necesidad del segundo.

1. Publica el update y comprueba al pie de la lista que pone `v1.2.0 · <id>`.
2. Ajustes de Android → Sistema → Idiomas → añade **English** y súbelo al primer puesto.
3. Cierra la app del todo (recientes → deslizar) y ábrela. Toda la app en inglés: la landing, el
   botón grande, la barra de añadir, las secciones «To buy» / «Bought».
4. Añade un artículo y súbele la cantidad a 2: el label accesible tiene que decir
   «Milk, quantity 2», no mezclar idiomas.
5. En la tarjeta del código, la caducidad tiene que decir «Expires in 6 days» (plural) y, si queda
   uno, «Expires in 1 day» (singular).
6. Borra un artículo: el snackbar dice «Milk deleted» y el botón «Undo».
7. **Modo avión y pulsa «Generate a new code»**: el aviso sale en inglés.
8. Vuelve a poner el móvil en español y repite el paso 3: todo vuelve a español.
9. Con el móvil en un idioma que no soportamos (portugués, por ejemplo), la app tiene que salir en
   **español**, no en inglés y no a medias.

El paso 9 es el que más se olvida y el que decide si alguien de fuera puede usar la app.

### Calidad

| Comprobación                         | Resultado                           |
| ------------------------------------ | ----------------------------------- |
| `npm run lint`                       | limpio                              |
| `npm run typecheck`                  | limpio                              |
| `npm test`                           | 190 tests, 27 suites, todo en verde |
| `npx expo export --platform android` | bundle generado, 5.47 MB            |

No se corre `test:rls` en este incremento: no toca esquema, ni políticas, ni RPCs.

### Decisiones sobre la marcha

**Los mensajes de `throw new Error` se quedan en español.** Son veintitantos, del estilo de
`No se pudieron cargar los artículos: <detalle de Supabase>`, y **ninguno se pinta ya**: van al log
y a la consola de Metro. Traducirlos sería traducir para nadie, y el proyecto se documenta en
español. La regla queda: si un `message` de excepción llega a la pantalla, el fallo es que llegue,
no que esté en español.

**No hay selector de idioma.** El idioma es el del móvil y no se puede cambiar dentro de la app. Un
selector obliga a persistir la elección, a esperar la hidratación de AsyncStorage antes del primer
render (el mismo problema del store de comunidad) y a decidir qué hacer cuando el móvil dice una
cosa y el ajuste otra. Todo eso para un caso de uso que en una beta entre conocidos no existe: la
gente tiene el móvil en el idioma que entiende. Si algún día hace falta, `supportedLanguages` y
`resolveLanguage` ya están donde tienen que estar y solo falta el store.

**El idioma se resuelve una vez, al arrancar el módulo.** Cambiar el idioma del sistema con la app
abierta no la traduce sola: hay que cerrarla y volver a abrirla. Android mata y recrea la app al
cambiar el idioma en casi todos los casos, así que en la práctica pasa desapercibido; escuchar el
evento y llamar a `changeLanguage` en caliente es trabajo para un problema que nadie tiene.

**Las claves de error de sesión cuelgan de `session.errors`, no de `errors`.** `errors` ya existe y
es para los fallos de red y de las mutaciones. Meter ahí el proveedor anónimo desactivado, que es un
fallo de configuración del backend y no algo que le pase a un usuario, mezclaría dos cosas que se
leen en momentos distintos.

---

## Incremento 4 · TalkBack

Pendiente. Cierra F.2 de la Fase 3. El guion está escrito en el bloque 4 de
`docs/guias/prueba-de-cierre-en-dispositivo.md`; lo que salga de ahí se anota aquí y se marca allí.

---

## Utillaje · Qué plugins de Claude Code usa el repo

No es un incremento, es una decisión de herramienta tomada el 2026-08-05 revisando el catálogo
completo (278 plugins en el marketplace oficial, 2199 en el comunitario). Se escribe aquí porque
afecta a cómo se trabaja en el proyecto y no cabe en un ADR: no cambia el modelo de datos ni la
seguridad, y mañana puede cambiar sin que nada del código se entere.

La lista y su declaración están en `.claude/settings.json`, que se commitea a propósito. Antes solo
existía `settings.local.json`, que está en `.gitignore`, así que la elección de plugins vivía en la
máquina de una persona.

### Los que entran

Los cuatro son del marketplace oficial de Anthropic. Instalados el 2026-08-05 con
`claude plugin install <nombre> --scope project`.

| Plugin           | Versión | Qué aporta que no tengamos ya                                                                                 |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `supabase`       | 0.1.13  | Postgres genérico (índices, tipos, transacciones) que `supabase-data` no repite. 296 tokens siempre activos   |
| `expo`           | 1.9.0   | `expo-deployment`, `eas-update-insights` y `expo-cicd-workflows`, terreno que se pisa al publicar la beta     |
| `context7`       | —       | Docs de la versión que tenemos instalada. Con el SDK clavado en 54 esto importa más que en un proyecto al día |
| `typescript-lsp` | 1.0.0   | Errores de tipos durante la edición, sin esperar al `npm run typecheck`                                       |

`context7` y `typescript-lsp` estaban ya instalados en la máquina en scope `local` y activos en el
global. Se declaran igualmente en el `settings.json` del repo para que quien clone el proyecto los
reciba, y para que sigan aquí aunque algún día se quiten del global.

### Solo marketplace oficial

Se descartó el marketplace comunitario **entero**, no un plugin concreto. Un plugin de la comunidad
es código de un tercero ejecutándose con los permisos de la sesión, igual que un paquete de npm pero
sin nadie que lo audite, y este repo tiene claves de Supabase en `.env`. El beneficio de cualquiera
de ellos no llega para pagar eso.

La consecuencia práctica está en `.claude/settings.json`: `extraKnownMarketplaces` declara solo
`claude-plugins-official`. Dejar el comunitario registrado «por si acaso» convertiría instalar uno de
fuera en un comando que funciona a la primera, sin fricción y sin decisión.

El caso que lo provocó fue `sync-docs` (`github.com/agent-sh/sync-docs`), que detecta documentación
desfasada respecto al código y encajaba bien con el volumen de `docs/` que tiene el proyecto. Se
propuso, se marcó como el único no oficial de la lista y el usuario decidió dejarlo fuera el
2026-08-05. La deuda que resolvía sigue abierta: nadie comprueba que los once ADR y los cinco
diarios de fase sigan describiendo el código que hay. De momento se cubre a mano al cerrar cada
incremento.

### El plugin `expo` entra con una condición

Cuesta **2357 tokens siempre activos**, más que todo lo demás junto, y la mitad de sus 18 skills son
para caminos que esta fase descartó por escrito: `expo-dev-client`, `expo-brownfield`,
`add-app-clip`, `web-to-native`, `expo-api-routes`. `expo-tailwind-setup` sobra porque NativeWind ya
está montado.

El problema de verdad es `upgrading-expo`. Se autocarga en cuanto la conversación roza subir de
versión y su consejo siempre será actualizar, que es exactamente lo contrario de la regla del SDK 54.
Por eso la prohibición está escrita en `CLAUDE.md`, en el mismo bullet que la regla del SDK y no en
una sección aparte: una skill que se carga sola pesa más que un párrafo lejano.

Si algún día el coste de contexto molesta antes que el beneficio, este es el primero que se va.

### Los que se descartaron, y por qué

- **`sentry` y `sentry-cli`**: Sentry está fuera del alcance de esta fase por decisión del usuario.
  Meter el plugin sería empezar a instalar la decisión contraria por la puerta de atrás.
- **`a11y-audit`, `accessibility-compliance`**: sus escáneres estáticos leen el DOM (React web, Vue,
  Angular, HTML). React Native no tiene DOM, así que no verían un solo `accessibilityRole` nuestro.
  El criterio de a11y de `CLAUDE.md` más la pasada manual con TalkBack cubren esto mejor.
- **`react-native-hifi`, `react-native-best-practices`**: solapan casi entero con `expo-stack`, que
  además conoce los ADR. Dos fuentes compitiendo dan peor resultado que una sola buena.
- **`vibeguard`, `security-sweep`**: escáneres genéricos de secretos y RLS. `npm run test:rls`
  ejecuta 24 comprobaciones reales contra el proyecto; un análisis estático que no ejecuta nada no
  añade nada por encima de eso.
- **`superpowers`**: trae su propio flujo de trabajo (TDD, subagentes, brainstorming) y chocaría con
  el que ya está escrito en `CLAUDE.md`.
- **`playwright`**: solo navegador.

### Los que se miran otra vez al publicar

Todos son del marketplace comunitario, así que a día de hoy la regla de arriba los deja fuera de
serie. Quedan apuntados porque el problema que resuelven aparece al publicar, y entonces habrá que
decidir de nuevo con el caso concreto delante:

- `appstore-screenshots`: capturas de ficha para Expo/RN con **Maestro** y fastlane. Encaja con el
  `npm run test:e2e` que ya existe.
- `playcraft`: ficha de Play Store, ASO, notas de versión, declaraciones de política.
- `android-emulator-qa-plugin`: árbol de UI, coordenadas y logcat. Sirve para el paso previo a
  TalkBack (comprobar que cada control expone label y rol), no para sustituirlo: TalkBack hay que
  oírlo.
- `metro-mcp`: debug en runtime vía Metro y CDP, sin tocar el código de la app. Sería útil para la
  cola offline, pero es de un solo autor.

Ojo a la trampa de este apartado: cuando llegue el momento de publicar, la tentación será instalar
el que toque «solo para esto». Si pasa, que sea rehaciendo la decisión de arriba y escribiéndola,
no saltándosela por prisa.
