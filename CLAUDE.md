# Lista de la Compra Colaborativa

App móvil en la que varias personas comparten una lista de la compra, sincronizada en tiempo real
aunque estén en redes y países distintos. Se entra con un código de invitación, un nombre y un PIN,
sin cuentas. Además de la lista: reparto de gastos, catálogo de Mercadona con foto y precio de
referencia, recetas, menú semanal, modo supermercado, PDF y notificaciones. Una persona puede estar
en varias listas. Expo (React Native) sobre Supabase, versión beta, **Android primero**.

No hace: cuentas con email o contraseña, precios en vivo ni versión web (`app.json` declara solo
`android` e `ios`).

Qué leer antes de tocar nada que no entiendas:

| Fichero | Qué te da |
| --- | --- |
| `docs/README.md` | El índice de la documentación, ordenado por a qué vienes |
| `docs/plan/ROADMAP.md` | El bloque «Estado», los paquetes, su orden y cuándo están terminados |
| `docs/plan/prompts/` | El prompt de arranque del siguiente incremento, para pegarlo tal cual |
| `docs/plan/PREGUNTAS.md` | Las dudas abiertas que decide Alejandro |
| `docs/especificacion-y-roadmap.md` | El documento maestro de producto: requisitos RF-1 a RF-16 |
| `docs/tecnica/ESTRUCTURA.md` | Dónde va cada cosa y dónde poner un fichero nuevo |
| `docs/tecnica/STACK.md` | Versiones y licencias, con fecha de comprobación |
| `docs/tecnica/METODO-DE-TRABAJO.md` | Cómo está montado Claude Code: skills, agentes, hooks y plugins, con su porqué |
| `docs/adr/` | Las decisiones, con lo que se descartó: 27 aceptadas |
| `docs/phases/fase-N.md` | El diario de cada fase: qué se hizo, cómo probarlo, deuda asumida |
| `DESIGN.md` | Cómo se ve la app. Léelo antes de pintar o tocar una pantalla |

El estado del proyecto, qué está hecho y qué va después, vive en el bloque «Estado» del ROADMAP. Un
hook lo imprime al abrir la sesión y tras cada `/compact`. No se copia aquí, porque aquí caduca.

La versión que corre en el móvil se ve al pie de la pantalla de lista: `v1.3.1 · base` si es el
bundle del APK, `v1.3.1 · <id>` si es un update por aire. Compruébala ahí antes de dar por hecho que
un cambio llegó al dispositivo.

---

## Reglas obligatorias

### 1. No cambies lo que ya está en producción sin permiso

Si vas a cambiar **el esquema ya aplicado, una política RLS, una RPC que usan los APK instalados,
la versión del SDK o algo que decide un ADR aceptado**, párate y pide permiso antes de escribir.
Di qué cambia, por qué, y el efecto con números: cuántas filas, qué versiones de la app se rompen,
qué dice `test:rls` antes y después.

Que esté mal no autoriza a arreglarlo por tu cuenta: se señala y se espera. Lo ya autorizado está en
`docs/adr/`; míralo antes de preguntar dos veces por lo mismo.

### 2. Documenta siempre, y busca lo actual y estable

Ningún cambio se cierra sin su documentación, en el mismo cambio. Qué va dónde lo dice la skill
`documentar-cambio`; una decisión que no encaje en ningún sitio va en `docs/phases/fase-N.md`, bajo
«Decisiones sobre la marcha». Nunca se queda solo en el chat.

Antes de añadir una dependencia o elegir una técnica, comprueba la versión y el uso actual con
context7 o la documentación oficial, compara al menos dos opciones y di por qué eliges una. No
heredes lo que diga un documento sin comprobarlo, incluido este. Estable antes que nuevo, pero nada
obsoleto por inercia.

### 3. Solo niveles gratuitos

Herramientas, librerías y servicios gratuitos, con licencia MIT, Apache-2.0, BSD o dominio público.
Supabase, EAS y Sentry van en su plan gratuito. Si algo solo se resuelve bien pagando, no se
contrata ni se configura: se propone con el coste, la alternativa libre y lo que se pierde, y decide
Alejandro. Una edición Community con lo útil en la de pago, o un plan gratis que no llega para el
uso diario, cuentan como de pago.

### 4. Los commits, los push y las publicaciones los hago yo

Ni `git commit`, `push`, `merge`, `rebase`, `tag`, `gh pr create` ni nada que escriba en el
historial o en GitHub. Tampoco `eas update`, `eas build`, `eas submit` ni `supabase db push`: llegan
a los móviles y a la base de otras personas. Ni aunque el trabajo esté terminado.

Lo que sí haces: dejar el árbol listo y darme `git status`, qué entra, qué se queda fuera y por qué,
el mensaje de commit en inglés e imperativo y las órdenes exactas. Si quiero lanzar algo desde la
sesión, lo escribo yo con `! <orden>`. Leer sí puedes: `git status`, `git diff`, `git log`,
`eas build:list`, `supabase migration list`.

El hook `bloquear-escrituras-git.mjs` lo deniega aunque se olvide, incluido lo escondido tras
`cd foo &&`, `-C` o `npx`. Hay además un `permissions.deny` de refuerzo y un `attribution` vacío
para que no se cuelen trailers de coautoría.

### 5. Ningún dato cruza de lista y ninguna escritura se pierde

El error que más cuesta y menos se ve en los tests. Una política, una RPC o una suscripción sin
filtro por `community_id` enseña datos de otra lista; una mutación sin `setMutationDefaults`, o con
un id que pone el servidor, pierde lo que se hizo sin red al reiniciar la app, sin un solo error.

Lo vigilan `npm run test:rls` (aislamiento entre listas), las reglas de datos de abajo y
`architecture-guard`. Una tabla, RPC o canal nuevo lleva su comprobación en
`scripts/rls-isolation-test.mjs` en el mismo cambio.

### 6. Lo que la app nunca dice

- Que un cambio está **guardado, sincronizado o al día para el grupo** cuando puede estar en la cola
  offline. Sin red se dice que se guardará al recuperarla.
- Que el **precio del catálogo es el actual**. Es de referencia: se enseña con su antigüedad y con
  «orientativo», y no se convierte en un gasto sin que una persona lo confirme.

Lo comprueba `src/shared/lib/i18n/__tests__/forbidden-claims.test.ts` sobre los textos en español e
inglés, y `revisor-interfaz` en cómo se combinan en pantalla.

---

## Reglas del proyecto

### Plataforma

**Android es prioritario.** Es donde se prueba y quien gana cuando dos plataformas piden cosas
distintas. iOS tiene que funcionar, pero no manda; si el coste para iOS de una decisión es alto, se
me dice antes de aplicarla. Un incremento está terminado cuando se ha visto en el Android real, con
el APK del perfil `preview` o un update por aire, no cuando compila. `npx expo export --platform
android` es la comprobación de build. El botón atrás del sistema, el retroceso predictivo (apagado a
propósito en `app.json`) y los permisos se tratan de forma explícita.

**La prueba en el Android la hace la sesión, por `adb` y Maestro, con el móvil por USB.** Lo primero
es mirar la `versionName` instalada: si no es la del incremento, se para. Se cambia de APK con
`adb install -r`, nunca desinstalando, y `clearState` en un móvil con listas de verdad se pregunta
antes. Nunca `maestro cloud`, que es de pago. Montaje y seguridad en `docs/guias/e2e-con-maestro.md`;
procedimiento en la skill `probar-en-android`.

### Stack y versiones

**SDK 57 (RN 0.86, React 19.2) y no se sube por tu cuenta.** Se subió de 54 por decisión mía cuando
se actualizaron los móviles de prueba. Antes de tocar el SDK, pregunta qué admiten los dispositivos;
no lo deduzcas de lo que devuelve `create-expo-app@latest`. La skill `upgrading-expo` del plugin
`expo` no se usa aquí: si se carga sola, ignórala y dilo.

**Un cambio nativo es `version` nueva en `app.json` y build nuevo.** El `runtimeVersion` sale de
la `version` (política `appVersion`): un update con un cambio nativo y la `version` igual se lo traga
el APK viejo y revienta. Cuenta como nativo cualquier dependencia con código nativo, el array
`plugins` de `app.json`, permisos, icono, el SDK y `npx expo install --fix`. La 1.2.0 es el último APK
de SDK 54 y no se publica nada contra ella. Procedimiento en la skill `publicar-version`.

**`package-lock.json` va en el mismo cambio que `package.json`.** EAS instala con `npm ci`, que falla
si no cuadran. Se comprueba con `npm ci --dry-run`.

**React Native Paper solo para `Snackbar`, `Dialog` y `Portal`, y solo dentro de `src/shared/ui`.**
El aspecto es nuestro, con NativeWind y los tokens de `src/theme`; Paper aporta las superposiciones
accesibles (ADR-0004).

**AsyncStorage para la caché, los stores persistidos y la sesión de Supabase.** No MMKV (ADR-0008,
que sigue mandando aunque su motivo, Expo Go, ya no aplique) y no `expo-secure-store` (límite de unos
2048 bytes por valor, menos que la sesión). Como es asíncrono, nada que dependa de un valor
persistido decide en el primer render: espera a la hidratación.

**Textos siempre por i18n.** Español por defecto e inglés según el idioma del móvil; cualquier otro
idioma cae en español y no hay selector dentro de la app. Los dos JSON viven en
`src/shared/lib/i18n/` y un test falla si se desincronizan. Un `throw new Error` lleva su mensaje en
español porque nunca se pinta: si uno acaba en pantalla, el fallo es que llegue.

### Arquitectura

Una sola app en la raíz, sin monorepo (ADR-0003). Features en `src/features/`: `catalog`,
`community`, `expenses`, `items`, `meal-planner`, `notifications`, `recipes` y `session`. Dónde va cada
fichero, en `docs/tecnica/ESTRUCTURA.md`; el detalle con código, en la skill `expo-stack`.

**`domain/` es puro.** Ni React, ni Supabase, ni Expo, ni Query, ni Zustand. Los casos de uso son
funciones puras con su test. El dominio define el puerto (interfaz) y `data/` lo implementa para
Supabase; la UI depende de hooks y casos de uso, nunca de Supabase.

**Una feature se consume solo por su `index.ts`.** Lo impone `no-restricted-imports` en
`eslint.config.js`, que genera un bloque por feature y capa con un bucle. En flat config el último
bloque que casa gana la regla entera, así que **un bloque nuevo de `no-restricted-imports` apaga en
silencio los de `domain/` y los de Paper**: si la tocas, repite los patrones y compruébalo con una
sonda. **Una feature nueva entra en el array `features` en el mismo cambio que crea su carpeta**; lo
vigila `repository-rules.test.ts` desde que tres features pasaron semanas fuera del lint.

**Para salir de tu módulo, alias `@/`; dentro de él, relativo.** Módulo es `features/<x>`, `shared`,
`theme` o `app`. El alias lo resuelven TypeScript, Metro y el `moduleNameMapper` del preset de
`jest-expo`: **no añadas un `moduleNameMapper` propio**, pisa el del preset entero. Lo que consuman
los scripts de `scripts/` va en relativo, porque Node no resuelve los `paths`.

**`shared/` tiene tres carpetas y no habrá una cuarta.** `ui/` lo presentacional, `hooks/` los hooks
sin nada de ninguna feature y `lib/` lo demás, que siempre envuelve un módulo de terceros. No hay
`utils/` (fase 6, Tarea 2, E4).

**En la raíz de `presentation/` no hay ficheros sueltos**, y solo existe la subcarpeta que tenga
contenido: `screens/` (el cuerpo de una ruta), `components/`, `hooks/`, `stores/` y `mutations/` (el
registro de `setMutationDefaults`). Los `__tests__/` van junto al fichero que prueban.

### Estado

**Server state solo en TanStack Query; client state en Zustand.** Nunca se copia el del servidor en
Zustand.

**Toda mutación es optimista, con rollback y aviso discreto** ante un error. La única excepción es
cuando la pantalla necesita un valor que genera el servidor y no se puede adivinar (el `join_code`
de `create_community`): ahí el botón se queda en carga.

**A qué listas pertenezco es server state** (`['my-communities']`, `useMyCommunities()`); **cuál
estoy mirando es client state** (`useActiveCommunityStore`, que guarda la `membership` entera para
pintar sin red y corrige `useActiveMembershipSync()`). No se añaden más datos de la lista a ese
store. Al crear o unirse se entra con `useEnterCommunity()`, nunca con `setMembership` directo. No
hay botón de salir: se cambia desde el título (`CommunitySwitcher`). Una notificación push lleva
`communityId` en sus datos, que pone `notifyCommunity`. Todo en ADR-0025.

### Datos, sincronización y offline

**La fuente de verdad es Supabase.** Cada cliente se suscribe a Realtime de su `community_id` y los
eventos reconcilian la caché. Suscribirse es un método del repositorio, siempre con
`filter: community_id=eq.<id>`. Conflictos: last-write-wins por `updated_at`.

**Todo método de `data/` que haga una petición suelta empieza por `assertOnline()`.** En Android una
petición sin red no falla: se encola y se ejecuta al reconectar, a espaldas del usuario. La única
excepción es abrir un canal de Realtime, que reconecta solo.

**Una mutación que se pueda encolar declara su `mutationKey` y registra su `mutationFn` con
`setMutationDefaults`**, y sus `variables` llevan todo lo que necesita, `communityId` incluido: al
rehidratar solo quedan clave, variables y estado (ADR-0009).

**El id de una fila que se pueda crear sin conexión lo genera el cliente** con `randomUuid()`, en la
llamada a `mutate`, y el `insert` lo manda explícito. El alta es idempotente: un `23505` significa
«ya se guardó» (ADR-0010).

### Errores

**`data/` no escribe mensajes para el usuario.** Envuelve con `serverError('<operacion>', error)` o
lanza `new ServerError('<operacion>', '<qué faltaba>')`. **`presentation/` no mira el error, lo
pasa** a `showError(cause)` de `useErrorSnackbar()` o a `useFailureMessage()`, que clasifican en
`offline`, `unreachable`, `timeout`, `rejected` o `unknown`. Nunca un ternario con `OfflineError`:
ese ternario disfrazó un error de esquema de fallo de cobertura durante cuatro días. El código de
error se enseña entre paréntesis, para que una captura valga como diagnóstico (ADR-0016).

### UX y accesibilidad

**Pensado para quien no sabe usar apps**: una acción principal grande por pantalla, respuesta
inmediata, «deshacer» tras borrar y valores por defecto sensatos (cantidad 1). Cada control nuevo
lleva `accessibilityLabel`, `accessibilityRole`, contraste AA y un área táctil de al menos 48 × 48
dp con 8 dp de separación, la cifra de Android (P-02); si el dibujo es más pequeño, crece con
`hitSlop`. Ningún estado depende solo del color.
Modo claro y oscuro desde los tokens, y el tamaño de fuente del sistema se respeta. Lo que no esté
en `DESIGN.md` no se usa sin añadirlo antes a `src/theme/tokens.js`.

### Base de datos

**El diseño va antes que la migración.** Una migración aplicada no se edita: se corrige con otra
encima, y el hook bloquea editar las que ya están en git. El orden:

1. Me enseñas el diseño y esperas OK: tablas, claves, `on delete` de cada FK, índices, políticas RLS
   y qué alternativa descartas. La política va en la misma migración que crea la tabla. El diseño
   pasa por `migration-reviewer`.
2. Buenas prácticas por defecto, y si te sales de una, dilo: dinero en enteros de céntimos con
   moneda explícita; fechas en `timestamptz`; nada denormalizado que haya que mantener a mano; las
   invariantes las comprueba la BD (`check`, `unique`, FK); lo que escribe varias tablas va en una
   RPC transaccional; índice en toda columna por la que se filtre o se haga join; la lógica de
   negocio vive en `domain/` y se prueba con Jest.
3. **Cambiar la firma de una función que expone PostgREST lleva el `drop function` de la firma
   anterior en la misma migración.** Si no, quedan dos sobrecargas y PostgREST devuelve `PGRST203` a
   todo cliente que no mande el parámetro nuevo. Tuvo la app cuatro días sin poder unirse a ninguna
   lista (fase 6, B.6).
4. Se documenta el porqué: ADR si cambia el modelo o la seguridad (ejemplo bien hecho: ADR-0005),
   la skill `supabase-data` si es detalle de una regla que ya existe.

Aplicarla al ensayo y al real es la skill `aplicar-migracion`, que lanzo yo.

### Seguridad

**RLS en todo, y probado.** Un usuario no puede leer ni escribir datos de otra lista. Sesión anónima
de Supabase más `members.auth_user_id`, con la pertenencia resuelta por una función
`security definer` (ADR-0002, que tiene dos trampas: recursión en las políticas y el huevo y la
gallina de unirse por código).

**Secretos fuera del repo.** `.env` está en `.gitignore` y la sesión no lo lee ni lo escribe;
`.env.example` lleva los nombres. El cliente usa la publishable key (`sb_publishable_...`). La secret
key (`sb_secret_...`) y la service key nunca van al cliente ni al repo: se saltan la RLS. El hook
`bloquear-secretos.mjs` para lo que tenga forma de clave.

```
EXPO_PUBLIC_SUPABASE_URL=https://mnjhkqpeeivitpfejoxq.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

**El hash del PIN vive en `member_secrets`, una tabla sin políticas que solo leen las RPC.** Nunca
se devuelve desde una función ni se pone en una tabla legible: `members` lo tuvo en una columna
visible para toda la lista hasta el 2026-10-12. `set_member_pin` lo fija y `reset_member_pin` (solo
admin) devuelve uno temporal. ADR-0026 tiene una segunda migración pendiente: léelo antes de tocar
`join_community`, que solo puede devolver sus seis estados porque los APK instalados no conocen
otros.

**El `join_code` es legible, sin `O/0` ni `I/1`, con límite de intentos, caduca a los 7 días** y
cualquier miembro lo rota con `rotate_join_code`. Como puede cambiar desde otro móvil, el que enseña
la pantalla sale de la query `['join-code', communityId]`, nunca de Zustand (ADR-0011).

### Catálogo

**`supermarkets` y `catalog_products` son las únicas tablas sin `community_id`.** Son de todos, con
`select` para `authenticated` y sin política de escritura: escribe solo la ingesta semanal con la
secret key (`catalog-ingest.yml`). La fuente es el dataset público de Mercadona (ADR-0012, ADR-0013).
Sus dos trampas (`word_similarity` satura a 1 y `gen types` jura que cinco columnas nulas no lo son)
están en la skill `supabase-data`.

**`items.image_path` guarda solo rutas de nuestro bucket, nunca una URL.** Si es `null` y hay
`catalog_product_id`, la foto sale del catálogo al pintar; la propia siempre gana (ADR-0014,
`items/domain/item-image-source.ts`).

**Si el catálogo trae datos de Open Food Facts, la pantalla lleva atribución visible.** ODbL 1.0 y
CC-BY-SA lo exigen. Publicar la app no activa el compartir-igual; ofrecer `catalog_products` como
export o API sí, y ese día deja de ser una decisión técnica
(`docs/guias/fuentes-de-datos-del-catalogo.md`).

---

## Cómo se trabaja

El método completo está en `docs/tecnica/METODO-DE-TRABAJO.md`. Lo que cada sesión tiene que saber:

**Plan primero.** Ante cualquier tarea me enseñas un plan corto (ficheros, decisiones, riesgos) y
esperas mi OK antes de escribir código o SQL. Si contesto «adelante», las decisiones van como las
propones y no vuelves a preguntar por ellas.

**Un paquete es una fase, y un incremento por sesión, con su prompt.** El paquete T-NN es la fase NN
y su diario es `docs/phases/fase-NN.md` (ADR-0027). Cada incremento arranca con su prompt de
`docs/plan/prompts/`, que dice qué leer, dónde escribir, qué no tocar y cuándo está terminado; fuera
de esa lista no se explora. Se trabaja en serie. Entre incrementos, `/clear`. **El plan de una fase o
funcionalidad nueva trae sus prompts**, uno por incremento, cada uno con el agente que le toca: lo
escribe la skill `prompt-de-paquete`.

**Tras cada incremento**, lint, typecheck y tests, y cómo probarlo a mano en el Android. No inventes
claves ni valores: pídemelos. Una duda que decido yo va a `docs/plan/PREGUNTAS.md` con números y
opciones.

**Antes de una tarea, la skill que le toca.** Están en `.claude/skills/` y mandan sobre cualquier
plugin; si se contradicen, gana la del repo y se anota.

| Tarea | Skill |
| --- | --- |
| Cualquier cosa en `src/`: capas, estado, mutaciones, Realtime, offline, aspecto | `expo-stack` |
| Esquema, RLS, RPC, Realtime, `db.types.ts` | `supabase-data` |
| Aplicar una migración al ensayo y al real (la lanzo yo) | `aplicar-migracion` |
| Publicar un update o un build (la lanzo yo) | `publicar-version` |
| El guion de prueba en el Android real | `probar-en-android` |
| Cerrar un incremento | `qa-runner` |
| Cerrar un paquete o una fase | `cerrar-paquete` |
| Dejar listo el prompt del siguiente | `prompt-de-paquete` |
| Una decisión con alternativas | `adr` |
| La documentación de un cambio | `documentar-cambio` |

**Los subagentes revisan, no arreglan.** Están en `.claude/agents/` y se lanzan uno detrás de otro,
nunca a la vez. Según lo que toque el cambio:

| Si tocó | Revisor |
| --- | --- |
| `src/` | `architecture-guard` |
| una pantalla o cómo se enseña un dato | `revisor-interfaz` |
| SQL, RLS, RPC o Realtime (el diseño y antes de cada `db push`) | `migration-reviewer` |
| manejo de errores, `catch`, fallbacks | `pr-review-toolkit:silent-failure-hunter` |
| tests o cobertura | `pr-review-toolkit:pr-test-analyzer` |
| el cierre de una fase | `docs-drift-auditor` |
| siempre, el último | `revisor-documentacion` |

`investigador-datos` no revisa: rastrea de dónde sale un dato de la pantalla hasta la tabla. Un
hallazgo se arregla o se apunta en el ROADMAP con su motivo; no se ignora en silencio. Un agente no
sustituye a `npm run lint`, `npm run test:rls` ni a la prueba en el Android. Si una regla de este
fichero cambia, se cambia también en el agente que la comprueba.

**Lo que sugiera un plugin pasa por este fichero.** Solo plugins del marketplace oficial de
Anthropic, declarados en `.claude/settings.json`, que se commitea. `silent-failure-hunter` pide
registrar cada error con su contexto; aquí un error lleva su operación y su código (ADR-0016), y
nada de lo que escribe el usuario. Si chocan, manda este fichero.

**Los hooks hacen lo mecánico.** Cargan el estado al abrir la sesión, bloquean las escrituras en git
y las publicaciones, protegen `.env`, `db.types.ts`, las migraciones ya en git y los ADR aceptados,
paran los secretos, pasan Prettier al escribir y, al terminar el turno, los tests de `domain/` si
cambió. Un bloqueo no se esquiva con otra herramienta: dice qué hacer en su lugar. Se prueban con
`npm run test:hooks`.

**Un paquete se cierra con la skill `cerrar-paquete`**: las cinco condiciones del ROADMAP, los
revisores, el guion en el Android, el bloque «Estado» y la entrega de la regla 4 con los recuentos
exactos.

### Dónde va cada decisión

Toda entrada responde a qué se cambió, por qué (qué se descartó y a costa de qué) y qué implica para
quien toque eso después.

| Tipo de decisión | Dónde se escribe |
| --- | --- |
| Arquitectura, seguridad, modelo de datos, librería | ADR nuevo en `docs/adr/`, con la skill `adr` |
| Detalle de una regla que ya existe (un `with check`, un índice) | La skill del área, junto al código de ejemplo |
| Qué se hizo en el incremento y cómo probarlo | `docs/phases/fase-N.md` |
| Procedimiento que habrá que repetir | `docs/guias/<tarea>.md` |
| Estado y lo que sigue | El bloque «Estado» de `docs/plan/ROADMAP.md` |
| Regla que se sigue siempre a partir de ahora | Este fichero |

---

## Estilo

El estilo común está en `~/.claude/CLAUDE.md`. Lo que añade este proyecto:

- Documentación en **castellano**, directa y sin manual corporativo. Nombres de código en
  **inglés**; textos de la interfaz siempre por i18n.
- Commits en inglés, imperativo y cortos, con el prefijo que usa el repo:
  `feat(community): add list switcher`, `docs(fase-15): ...`.
- TypeScript `strict`, con los tipos generados del esquema. Sin `any` para callar al compilador.
- ESLint y Prettier limpios antes de dar algo por terminado. Tests de `domain/` y `data/` por
  encima del 70 % (el umbral está en `jest.config.js`); la UI no se persigue.
- Ficheros en `kebab-case`, salvo los ADR (`ADR-NNNN-...`) y los de la raíz en mayúsculas.
- Prohibidas en cualquier texto: delve, leverage, tapestry, seamless, robust, groundbreaking, «cabe
  destacar», «es importante mencionar», «en el panorama actual», it's worth noting, furthermore,
  moreover, additionally. Sin negritas mecánicas ni rayas largas a cada frase.

## Vocabulario del dominio

Hablamos en castellano, codificamos en inglés. Esta tabla y `docs/tecnica/GLOSARIO.md` dicen lo
mismo: si cambias una, cambias la otra.

| Término | En código | Significado |
| --- | --- | --- |
| Lista | `community` | Lo que comparte un grupo. La interfaz dice «lista»; el código y el esquema, `community` |
| Miembro | `member` | Una persona en una lista, con nombre único en ella |
| Pertenencia | `Membership` | Que una sesión esté en una lista. Unidad del selector de listas |
| Lista activa | `useActiveCommunityStore` | La que estoy mirando. Client state (ADR-0025) |
| Código de invitación | `join_code` | Para entrar en una lista. Caduca y se rota (ADR-0011) |
| PIN | `pin` | Cuatro dígitos por miembro; hash en `member_secrets` (ADR-0026) |
| Administrador | `isAdmin` / `is_admin` | Puede quitar miembros y restablecer un PIN (ADR-0017) |
| Invitado | `isGuest` | Participante de los gastos sin la app (RF-12) |
| Artículo | `item` | Fila de la lista: nombre, cantidad, foto, categoría y estado |
| Pendiente / comprado | `purchased` | Estado del artículo, siempre con icono y texto |
| Categoría | `ItemCategory` | Pasillo del supermercado (ADR-0024) |
| Modo supermercado | `shopping-mode` | Pantalla para comprar, agrupada por pasillos |
| Catálogo | `catalog_products` | Productos de Mercadona; única tabla compartida (ADR-0012) |
| Precio de referencia | `price_cents` + `price_checked_at` | Precio orientativo con su fecha; no es un gasto |
| Gasto | `expense` | Pago repartido entre miembros, en céntimos (ADR-0005) |
| Liquidación | `Settlement` | Pago entre miembros para saldar deudas |
| Balance | `MemberBalance` | Calculado en `domain/`, nunca guardado |
| Receta | `recipe` | Ingredientes que se vuelcan a la lista (ADR-0021) |
| Menú semanal | `meal-planner` / `MealPlanSlot` | Recetas por día y comida, consolidadas en la lista (ADR-0022) |
| Cola offline | `setMutationDefaults` + `mutationKey` | Cambios sin red que se envían al reconectar (ADR-0009) |
| Presencia | `PresenceRepository` | Quién mira la lista ahora |
| Paquete | `T-NN` | Una fase del ROADMAP, con su número (ADR-0027) |
| Incremento | — | Un trozo de paquete que se hace y se prueba en una sesión |

## Órdenes

```bash
# Desarrollo
npx expo start                 # QR para el development build (expo-dev-client está instalado)
npx expo start --go            # Expo Go; solo si el del móvil admite SDK 57
npx expo start --tunnel        # si el móvil y el PC no están en la misma Wi-Fi

# Calidad
npm run lint
npm run typecheck
npm test
npm run test:coverage          # dominio y data; umbral del 70 % en jest.config.js
npm run test:hooks             # que los hooks de .claude/ bloquean lo que deben
npx expo export --platform android

# Tras añadir una ruta en src/app, arranca el server una vez antes del typecheck: el dev server
# genera .expo/types/router.d.ts y hasta entonces tsc falla con «RelativePathString».
npx expo start

# Tipos de Supabase, desde Git Bash (en PowerShell 5.1 el '>' escribe UTF-16 y rompe ESLint)
npx supabase gen types typescript --linked > src/shared/lib/db.types.ts

# Aislamiento entre listas, catálogo, gastos idempotentes, varias listas, PIN fuera de members y
# RPC de recetas, gastos y menús. 102/102 contra el real (101/102 sin SUPABASE_SECRET_KEY)
npm run test:rls

# Realtime: artículos, gastos, miembros, filtro por lista, aislamiento y presencia. 18/18
npm run test:realtime

# Catálogo. Los flags solo llegan desde Git Bash; PowerShell 5.1 se come el '--'
npm run catalog:benchmark -- --source hf --limit 20
npm run catalog:ingest -- --dry-run      # sin escribir ni clave
npm run catalog:ingest                   # upsert idempotente con la secret key

# Usuarios de auth: cuántos hay y cuáles son huérfanos
npm run users
npm run users -- --delete-orphans

# E2E con Maestro (CLI fuera de npm, adb y el APK instalado; no con Expo Go). Deja una lista real
# en Supabase y clearState borra la sesión del móvil. adb y Maestro viven en ~/tools, sin PATH:
# docs/guias/e2e-con-maestro.md. camino-feliz y cola-offline están desfasados desde la fase 15
npm run test:e2e
export PATH="$HOME/tools/platform-tools:$PATH"   # desde Git Bash, para un flujo suelto
cmd //c "%USERPROFILE%\tools\maestro\bin\maestro.bat" test .maestro/pin-unirse.yaml
~/tools/platform-tools/adb.exe shell dumpsys package com.alejandrohernandez.listacompra | grep versionName
```

## Reglas añadidas por Alejandro

1. **El plan de una fase o funcionalidad nueva trae sus prompts**, uno por incremento, listos para
   pegar, cada uno con el agente que le toca. Pedido el 2026-10-11.
2. **El código y la versión del SDK no se tocan sin plan aprobado.** Ver «Plan primero» y la regla 1.
