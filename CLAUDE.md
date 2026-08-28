# Proyecto: Lista de la Compra Colaborativa

App móvil donde varias personas comparten UNA lista de la compra por comunidad,
sincronizada en tiempo real aunque estén en redes y países distintos. Acceso por
código de invitación + nombre de usuario (sin cuentas, versión beta).

> Especificación completa (léela antes de decisiones grandes):
> `docs/especificacion-y-roadmap.md`
> Trabaja SIEMPRE por fases (0 → 4). No saltes de fase sin cerrar la anterior.

---

## Plataforma objetivo

**Android es prioritario.** Es donde se prueba, donde se decide si algo funciona y a quién le
toca ganar cuando dos plataformas piden cosas distintas. iOS es secundario: tiene que
funcionar, pero no manda.

En la práctica:

- Verifica en Android. Un incremento no está terminado porque compile: está terminado cuando se
  ha visto en el Android real vía Expo Go.
- `npx expo export --platform android` es la comprobación de build por defecto.
- Ante una decisión que beneficie a una plataforma y perjudique a la otra, gana Android. Si el
  coste para iOS es alto, dímelo antes de aplicarla.
- El comportamiento propio de Android (botón atrás del sistema, gesto de retroceso predictivo,
  permisos) se maneja explícitamente, no se deja al comportamiento por defecto.

## Stack

- **Expo (React Native)** + **Expo Router** (navegación por ficheros) + **TypeScript (strict)**.
  - **SDK fijado en 54. No lo subas.** El Expo Go del Android de pruebas es cliente **54.0.8** y solo admite **SDK 54**, y ese dispositivo no puede actualizar Expo Go desde el Play Store. Un proyecto en SDK 55+ no arranca ahí: da "Project is incompatible with this version of Expo Go" y no hay forma de sortearlo sin development build.
  - Antes de tocar la versión del SDK, **pregunta qué SDK admite el Expo Go del dispositivo real**. No lo deduzcas de lo que devuelva `create-expo-app@latest`, que siempre da la última. Se comprueba abriendo Expo Go: muestra "Client version" y "Supported SDK".
  - **La skill `upgrading-expo` del plugin `expo` no se usa en este repo.** El plugin está habilitado por sus skills de despliegue y EAS, pero trae una que se autocarga en cuanto alguien menciona subir de versión y cuya única recomendación posible es lo contrario de la regla de arriba. Si se carga sola, ignórala y dilo. Subir el SDK es una decisión del usuario con el móvil de pruebas delante, nunca una sugerencia de una skill genérica.
- **Estado servidor:** TanStack Query (caché, refetch, mutaciones, optimistic updates).
- **Estado cliente:** Zustand (sesión local, tema, UI). **Nunca dupliques el estado del servidor en Zustand.**
- **Backend (BaaS):** Supabase → Postgres + Realtime + Storage + RLS.
- **UI:** NativeWind (Tailwind para RN) + componentes propios en `src/shared/ui`. Tokens de diseño en `src/theme`.
  - **React Native Paper solo para `Snackbar`, `Dialog` y `Portal`.** Nada más. El aspecto de la app es nuestro; Paper aporta las superposiciones accesibles, que son las que cuesta hacer bien a mano. Un import de `react-native-paper` fuera de `src/shared/ui` es un error de revisión. Razonado en [ADR-0004](docs/adr/ADR-0004-libreria-de-ui.md).
- **Persistencia local:** `@react-native-async-storage/async-storage`, para la caché de Query y para los stores persistidos de Zustand. **No react-native-mmkv**: es un módulo nativo de terceros y no arranca en Expo Go, que es como se prueba este proyecto. Razonado en [ADR-0008](docs/adr/ADR-0008-persistencia-local-de-la-cache.md). Como es asíncrono, **nada que dependa de un valor persistido puede decidir en el primer render**: hay que esperar a la hidratación. **Conectividad:** @react-native-community/netinfo.
- **Imágenes:** expo-image, expo-image-picker, expo-image-manipulator (comprimir antes de subir).
- **Sesión:** `@react-native-async-storage/async-storage` como almacén de la sesión de Supabase. **No expo-secure-store**: tiene un límite de ~2048 bytes por valor y la sesión de Supabase (access + refresh token) lo supera, así que falla de forma intermitente y difícil de diagnosticar. Ver `docs/phases/fase-0.md`.
- **i18n** desde el inicio (ES por defecto, preparado para EN). Nada de textos hardcodeados.

---

## Estructura de carpetas

```
src/
├── app/                      # Rutas (Expo Router): landing, join/[code], list
├── features/                 # Una carpeta por feature, autocontenida
│   └── <feature>/
│       ├── domain/           # Entidades + casos de uso. SIN React ni Supabase.
│       ├── data/             # Repositorio: interfaz (puerto) + adaptador Supabase
│       └── presentation/     # screens / components / hooks (TanStack Query aquí)
├── shared/
│   ├── ui/                   # Design system desacoplado (Button, Input, Card...)
│   ├── lib/                  # cliente Supabase, i18n, config
│   ├── hooks/  └── utils/
└── theme/                    # tokens: color, spacing, tipografía, radios
```

Features previstas: `community`, `items`, `session`.

Y el reparto de la raíz:

```
README.md          qué es esto y cómo arrancarlo
CLAUDE.md          este fichero: las reglas duras
.env.example       nombres de variables, sin valores
docs/              ver abajo
scripts/           herramientas de CLI/CI, fuera del bundle de la app
supabase/          migraciones y config de la CLI (no tocar a mano salvo migrations/)
src/               todo el código de la app
```

**Una sola app, en la raíz. No hay monorepo** y no lo habrá hasta que haya código real que
compartir entre dos proyectos. Razonado en
[ADR-0003](docs/adr/ADR-0003-estructura-del-repositorio.md).

`docs/` se organiza por **para qué sirve** cada documento, no por tema:

| Carpeta                            | Contiene                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `docs/especificacion-y-roadmap.md` | El documento maestro. Referencia.                                                                                               |
| `docs/adr/`                        | Por qué las cosas son como son. Numerados, y **no se editan**: si cambias de opinión, escribe uno nuevo que supersede al viejo. |
| `docs/phases/`                     | Diario por fase: qué se hizo, cómo probarlo, deuda asumida.                                                                     |
| `docs/guias/`                      | Instrucciones paso a paso para tareas concretas.                                                                                |

Nombres de fichero en `kebab-case` minúsculas. Excepciones: los ADR (`ADR-NNNN-...`) y los de
la raíz que van en mayúsculas por convención (`README.md`, `CLAUDE.md`).

---

## Reglas de arquitectura (duras)

- **`domain/` no importa NADA de React ni de Supabase.** Verifícalo (los casos de uso son funciones puras y testeables).
- **Repositorios como puertos + adaptador:** el dominio define una interfaz; `data/` la implementa para Supabase. Cambiar de proveedor = crear otro adaptador, sin tocar `domain/`.
- La UI depende de **hooks/casos de uso**, nunca de Supabase directamente.
- Componentes de `shared/ui` **presentacionales**: reciben props, no conocen la lógica de datos.

## Reglas de estado

- Server state **solo** en TanStack Query. Client state (tema, sesión, UI) en Zustand.
- Toda mutación con **actualización optimista + rollback** ante error de red (+ aviso discreto, snackbar).
  - Única excepción: cuando el valor que la pantalla necesita lo genera el servidor y no se
    puede adivinar (el `join_code` de `create_community`). Ahí el botón se queda en carga y se
    espera. Si dudas, la mutación sí puede ser optimista. Razonado en `docs/phases/fase-1.md`.

## Reglas de errores

- **`data/` no escribe mensajes para el usuario.** Todo error de Supabase se envuelve con
  `serverError('<operacion>', error)` (`src/shared/lib/errors.ts`), que guarda la operación, el
  detalle del servidor y el código. Lo que no viene de un error se lanza como
  `new ServerError('<operacion>', '<qué faltaba>')`.
- **`presentation/` no mira el error, lo pasa**: `showError(cause)` de `useErrorSnackbar()`, o
  `useFailureMessage()` si el texto se pinta en línea. Ese hook clasifica en `offline`, `unreachable`,
  `timeout`, `rejected` o `unknown` y elige la clave de i18n. **Nunca vuelvas a escribir
  `cause instanceof OfflineError ? ... : t('errors.network')`**: esa clave ya no existe y ese ternario
  es lo que disfrazó un error de esquema como un fallo de cobertura durante cuatro días.
- **El código de error se le enseña al usuario**, entre paréntesis. Una captura de pantalla tiene que
  valer como diagnóstico.

Razonado en [ADR-0016](docs/adr/ADR-0016-clasificacion-de-errores-y-mensaje-al-usuario.md).

## Reglas de UX y accesibilidad (no negociables)

- Pensado para **usuario novato**: una acción principal grande y evidente por pantalla; feedback inmediato; **"deshacer"** tras borrar; valores por defecto sensatos (cantidad = 1).
- Cada control nuevo: `accessibilityLabel` + `accessibilityRole`, **contraste AA**, área táctil **≥ 44×44 pt**.
- Estados no dependientes solo del color (icono + texto para "comprado").
- Soporta **modo claro/oscuro** desde los tokens y respeta el tamaño de fuente del sistema.

## Reglas de datos y sincronización

- Fuente de verdad = Supabase. Cada cliente **se suscribe a Realtime** de su `community_id`; los eventos reconcilian la caché de TanStack Query.
- Los cambios se propagan entre redes/países porque todos hablan con el mismo backend (no entre sí).
- Offline pragmático: última lista cacheada (TanStack persist + AsyncStorage); mutaciones encoladas y reenviadas al reconectar (NetInfo). Conflictos simples → last-write-wins por `updated_at`.
- **Una mutación que se pueda encolar declara su `mutationKey` y registra su `mutationFn` con `setMutationDefaults`**, y sus `variables` cargan con todo lo que esa función necesita (`communityId` incluido). Una función no se serializa: al rehidratar solo quedan clave, variables y estado, así que lo que viva en el closure del hook se pierde al reiniciar la app. Razonado en [ADR-0009](docs/adr/ADR-0009-cola-de-mutaciones-offline.md).
- **El id de una fila que se pueda crear sin conexión lo genera el cliente** (`randomUuid()` de `src/shared/lib/uuid.ts`), en la llamada a `mutate` para que viaje en las `variables`, y el `insert` lo manda explícito. Un id que pone el servidor no se conoce hasta que responde, así que cualquier cambio posterior hecho en la misma sesión offline apuntaría a un id inventado y se perdería sin error. El alta pasa a ser idempotente: un `23505` significa "esto ya se guardó". Razonado en [ADR-0010](docs/adr/ADR-0010-id-del-articulo-generado-en-el-cliente.md).
- **Todo método de `data/` que haga una petición suelta empieza por `assertOnline()`** (`src/shared/lib/network.ts`). En Android una petición sin red no se rechaza: se encola y se ejecuta al reconectar, así que sin esa comprobación el usuario ve un spinner eterno y la escritura ocurre a su espalda. El timeout del cliente de Supabase cubre el otro caso (con red pero sin servidor). Razonado en `docs/phases/fase-1.md`.
  - **Única excepción: abrir un canal de Realtime** (`subscribe()`). Un canal no es una petición suelta: reconecta solo y avisa de su estado por `onStatus`. Bloquearlo porque NetInfo diga que no hay red sería no reconectar nunca al volver. Razonado en `docs/phases/fase-2.md`.
- **Suscribirse a Realtime es un método del repositorio, no un import de Supabase en `presentation/`.** Siempre con `filter: community_id=eq.<id>`: sin filtro llegan los borrados de otras comunidades. Razonado en `docs/phases/fase-2.md`.

## Cambios de esquema (SQL): el diseño va antes que la migración

Una migración aplicada **no se edita**, se corrige con otra encima. Eso hace que equivocarse en
el esquema cueste mucho más que equivocarse en una pantalla, así que el orden es:

1. **Enséñame el diseño y espera OK** antes de escribir el `.sql`: tablas, claves, `on delete`
   de cada FK, índices, políticas RLS y qué alternativa descartas y a costa de qué. No vale
   "creo la tabla y luego vemos la RLS": la política va en la misma migración que crea la tabla.
2. **Aplica las buenas prácticas por defecto**, y si te sales de alguna, dilo y explica por qué:
   - Dinero en **enteros de céntimos**, nunca flotantes. Moneda explícita.
   - Fechas siempre `timestamptz`, nunca `timestamp`.
   - Un hecho se guarda una vez. Nada de totales o contadores denormalizados que haya que
     mantener a mano: se calculan, y si el rendimiento lo pide, con vista o índice.
   - Las invariantes las comprueba la BD (`check`, `unique`, FK), no la confianza en el cliente.
   - Lo que escribe varias tablas a la vez va en una RPC transaccional, no en tres llamadas
     desde el móvil.
   - Índice en toda columna por la que se filtre o se haga join.
   - **Cambiar la firma de una función que expone PostgREST lleva el `drop function` de la firma
     anterior en la misma migración.** Un `create or replace` que añade un parámetro no reemplaza:
     crea otra sobrecarga, y con dos candidatas PostgREST devuelve `PGRST203` a todo cliente que no
     mande el parámetro nuevo, incluida la versión de la app que ya está instalada en un móvil. Pasó
     el 2026-08-24 con `p_pin` y tuvo la app cuatro días sin poder unirse a ninguna lista. Detalle en
     la skill `supabase-data` y en `docs/phases/fase-6.md` (B.6).
   - La lógica de negocio vive en `domain/`, no en SQL. Postgres guarda e impone reglas de
     integridad; los algoritmos se prueban con Jest.
3. **Documenta el porqué** donde toque: ADR nuevo si cambia el modelo de datos o la seguridad;
   la skill `supabase-data` si es el detalle de una regla que ya existe; `docs/phases/fase-N.md`
   si es de la fase en curso. Nunca solo en el chat.

Ejemplo de esto hecho bien, con el diseño fijado antes de existir el código:
[ADR-0005](docs/adr/ADR-0005-reparto-de-gastos.md).

---

## Seguridad (beta) y variables de entorno

- **RLS activo**: un usuario NO puede leer ni escribir datos de otra comunidad. Impleméntalo y pruébalo explícitamente.
- **Modelo de sesión**: sesión anónima de Supabase (`signInAnonymously`) + `members.auth_user_id`, con las políticas resolviendo la pertenencia vía función `security definer`. Decidido y razonado en `docs/adr/ADR-0002-modelo-de-sesion-y-rls.md` — léelo antes de tocar auth o RLS, tiene dos trampas (recursión en las políticas, y el huevo-y-gallina de unirse por código).
- **Secretos fuera del repo.** `.env` está en `.gitignore`. Mantén `.env.example` con los nombres (sin valores).
- Variables (en Expo, lo que la app lee necesita prefijo `EXPO_PUBLIC_`):

```
EXPO_PUBLIC_SUPABASE_URL=https://mnjhkqpeeivitpfejoxq.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # publishable key (pública, segura en cliente)
```

- **Usa la publishable key** (`sb_publishable_...`) en el cliente. Es de bajo privilegio y segura para incrustar en la app; la seguridad real la dan las políticas RLS.
- **NUNCA** uses ni commitees la _secret key_ (`sb_secret_...`) ni la _service key_: se saltan RLS y son solo de servidor.
- `join_code`: aleatorio, legible, sin caracteres ambiguos (`O/0`, `I/1`). Rate limit en "unirse".
  **Caduca a los 7 días** (`communities.join_code_expires_at`, plazo en `join_code_lifetime()`) y
  cualquier miembro puede cambiarlo con `rotate_join_code`, que mata al anterior en el acto. Como
  puede cambiar desde otro móvil, **el código que enseña la pantalla sale de una query
  (`['join-code', communityId]`), nunca del store de Zustand**. Razonado en
  [ADR-0011](docs/adr/ADR-0011-caducidad-y-rotacion-del-join-code.md).

---

## Convenciones de código

- TypeScript `strict`. Genera y usa los tipos del esquema de Supabase.
- ESLint + Prettier limpios antes de dar una tarea por terminada.
- Nombres en inglés para código; textos de UI vía i18n.
- Tests: dominio y repositorios ≥ 70% cobertura. No perseguir 100% en UI.

---

## Skills del proyecto

En `.claude/skills/`. Se cargan solas cuando el trabajo entra en su territorio; este fichero
es el resumen, ellas tienen el detalle con ejemplos de código.

| Skill           | Consúltala para                                                                     |
| --------------- | ----------------------------------------------------------------------------------- |
| `expo-stack`    | Cualquier cosa dentro de `src/`: capas, estado, mutaciones, Realtime, offline, a11y |
| `supabase-data` | Esquema, RLS, RPCs, Realtime, `db.types.ts`, claves                                 |
| `qa-runner`     | Cerrar un incremento o una fase                                                     |

## Plugins de Claude Code

Los que este proyecto necesita están declarados en `.claude/settings.json`, que **sí se commitea**
(el que no se commitea es `settings.local.json`). Así viajan con el repo y no cargan contexto en
otros proyectos de la máquina.

| Plugin                                   | Para qué                                                    |
| ---------------------------------------- | ----------------------------------------------------------- |
| `supabase@claude-plugins-official`       | Buenas prácticas de Postgres y Supabase                     |
| `expo@claude-plugins-official`           | Despliegue, EAS Update y CI de Expo                         |
| `context7@claude-plugins-official`       | Docs de la versión exacta de cada librería, no de la última |
| `typescript-lsp@claude-plugins-official` | Diagnósticos de tipos mientras se edita                     |

**Solo plugins del marketplace oficial de Anthropic.** Un plugin de la comunidad es código de un
tercero ejecutándose con tus permisos, igual que un paquete de npm pero sin que nadie lo audite.
Este repo tiene claves de Supabase en `.env` y un `settings.json` con permisos; no compensa. Por eso
`extraKnownMarketplaces` declara solo `claude-plugins-official`: si algún día hace falta uno de
fuera, que sea una decisión consciente y no un `install` que funciona porque el marketplace ya
estaba puesto.

Las tres skills de `.claude/skills/` mandan sobre cualquier plugin. Un plugin da contexto genérico;
ellas conocen los ADR de este proyecto. Si se contradicen, gana la skill del repo, y la
contradicción se anota.

Elegidos el 2026-08-05 mirando el catálogo entero; qué se descartó y por qué, en
`docs/phases/fase-5.md`.

---

## Flujo de trabajo contigo (Claude)

1. **PLAN primero.** Ante cualquier tarea, muéstrame un plan corto (archivos a crear/editar, decisiones, riesgos) y espera mi OK antes de escribir código.
2. Implementa en **incrementos pequeños y verificables**.
3. Tras cada incremento: corre **lint + typecheck** (+ tests si hay) y dime **cómo probarlo a mano**.
4. **Documenta TODO lo que decidas.** Ninguna decisión se queda solo en el chat: el chat se
   pierde, el repo no. Vale igual para las decisiones pequeñas que tomes sobre la marcha sin
   preguntarme.
5. No inventes claves ni valores; pídemelos si faltan. No hagas commits de secretos.

### Dónde va cada cosa

Toda entrada responde a tres preguntas: **qué** se cambió, **por qué** (qué alternativa se
descartó y a costa de qué) y **qué implica** para quien toque eso después.

| Tipo de decisión                                                                            | Dónde se escribe                              |
| ------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Arquitectura, seguridad, modelo de datos, elección de librería                              | ADR nuevo en `docs/adr/`, numerado            |
| Detalle de implementación de una regla que ya existe (un `with check`, un índice, un grant) | La skill del área, junto al código de ejemplo |
| Qué se hizo en este incremento y cómo probarlo                                              | `docs/phases/fase-N.md`                       |
| Procedimiento repetible que alguien tendrá que volver a ejecutar                            | `docs/guias/<tarea>.md`                       |
| Regla que debo seguir siempre a partir de ahora                                             | Este fichero                                  |

Si una decisión no encaja en ninguna, va en `docs/phases/fase-N.md` bajo "Decisiones sobre la
marcha". Nunca se queda sin escribir.

**Fase actual: 6 (catálogo y reparto de gastos), abierta el 2026-08-07.** El MVP (fases 0 → 4) está
cerrado y probado en dispositivo con dos móviles; su diario está en `docs/phases/`. Las dos últimas
se cerraron el 2026-08-05 de una sentada; qué se probó y con qué resultado, en
`docs/guias/prueba-de-cierre-en-dispositivo.md`.

**La Fase 5 (endurecimiento) se cerró el 2026-08-16.** Su alcance lo eligió el usuario y fueron
cuatro cosas: id del artículo generado en el cliente, expiración y rotación del `join_code`
(migración aplicada el 2026-08-05), i18n en inglés y la pasada con TalkBack, que se recorrió entera
el 2026-08-16 y pasó limpio, cerrando de paso el criterio F.2 que la Fase 3 dejó a deber. Todo lo
demás (PIN, Sentry, push, roles, analítica, development build) quedó fuera a propósito. Detalle en
`docs/phases/fase-5.md`.

Lo que se arrastra y no se puede perder de vista:

- **El inglés no se ha visto nunca en un móvil.** Los incrementos 1 y 2 se probaron en dispositivo
  el 2026-08-06 y pasaron enteros; el guion del 3 (cambiar el idioma del sistema) no se recorrió por
  decisión del usuario, porque para esta beta lo que importa es el castellano. Si la detección de
  idioma fallara se cae en español, así que el riesgo está acotado, pero nadie ha comprobado cómo se
  ve un texto en inglés ni qué devuelve `getLocales()` en ese Android. Detalle y guion en
  `docs/phases/fase-5.md`.

**La app se ve en español o en inglés según el idioma del móvil**, y vuelve a español con cualquier
otro. Los dos JSON viven en `src/shared/lib/i18n/` y hay un test que falla si se desincronizan
(claves, `{{placeholders}}` o plurales). No hay selector de idioma dentro de la app, a propósito.
Un `throw new Error` sigue llevando su mensaje en español porque no se pinta nunca: si uno acaba en
pantalla, el fallo es que llegue. Detalle en el incremento 3 de `docs/phases/fase-5.md`.

La versión que corre en el móvil se ve al pie de la pantalla de lista (`v1.2.0 · base` si es el
bundle del APK, `v1.2.0 · <id>` si es un update por aire). Compruébala ahí antes de dar por
hecho que un cambio llegó al dispositivo.

RF-8 (PDF), RF-9 (reparto de gastos) y RF-10 (catálogo de productos de supermercado) son
**post-MVP**: están registrados en §3 y §12 del documento maestro.
El requisito de entrada del reparto de gastos ([ADR-0005](docs/adr/ADR-0005-reparto-de-gastos.md), identidad no suplantable)
quedó resuelto el 2026-08-24 con el PIN por miembro ([ADR-0015](docs/adr/ADR-0015-pin-por-miembro-para-identidad-no-suplantable.md)).

**RF-9 está escrito, no terminado.** El bloque B de la Fase 6 tiene esquema, RPC transaccional,
balances y liquidación mínima en `domain/` y su pantalla, pero **no cumple cuatro reglas duras de este
fichero**: sus mutaciones no son optimistas, borrar un gasto no se puede deshacer, no hay suscripción
a Realtime y no se puede encolar sin conexión. Está listado en `docs/phases/fase-6.md` (B.5) y es lo
siguiente que hay que hacer en la fase. Tampoco se ha visto nunca en un móvil.

El catálogo (RF-10, [ADR-0012](docs/adr/ADR-0012-catalogo-de-productos-de-supermercado.md)) es el
bloque A de la Fase 6 y **está en Aceptado desde el 2026-08-07**: la fuente la eligió el usuario con
la medición delante y es el dataset público de Mercadona en Hugging Face, un solo supermercado, con
GitHub Action semanal. Razonado en
[ADR-0013](docs/adr/ADR-0013-fuente-del-catalogo-mercadona.md). **El esquema está aplicado en remoto
desde el 2026-08-14** y **la tabla tiene 4.979 productos de Mercadona actualizados por la GitHub Action el 2026-08-24**
(`catalog-ingest.yml`, ejecutada en verde en 23s tras configurar el secret `SUPABASE_SECRET_KEY`).
La búsqueda funciona de punta a punta desde el 2026-08-16: el ranking en
`src/features/catalog/domain/rank-catalog-results.ts` con sus tests, la RPC `search_catalog` con su
corrección aplicada, y el puerto y el adaptador en `src/features/catalog/`. **Las sugerencias salen
bajo el campo de añadir y su foto llega al artículo** (`catalog/presentation/`), probado en Jest y
**verificado en el Android real el 2026-08-24** con todos los flujos pasando limpios. El precio se guarda enlazado pero **no se
pinta en la lista**; su consumidor es RF-9, ya escrito. Dos trampas de esa
búsqueda están contadas en el diario de la fase y conviene leerlas antes de tocarla: **el
`word_similarity` de Postgres satura a 1** (sirve para filtrar, nunca para ordenar) y **`gen types`
no sabe inferir la nulabilidad de un `returns table`**, así que jura que `brand`, `image_url`,
`package_size`, `price_cents` y `price_checked_at` no son nulos y los cinco lo son. Dos cosas suyas
afectan a reglas de arriba desde ya: `supermarkets` y `catalog_products` son las primeras tablas que **no se filtran por
`community_id`** (son datos compartidos por todos, con `select` para `authenticated` y ninguna
política de escritura, así que escribe solo la ingesta con la secret key), y el precio que trae es
**de referencia**: se enseña con su fecha y no se convierte en un gasto sin que una persona lo
confirme.

**`items.image_path` guarda solo rutas de nuestro bucket, nunca una URL.** Si está a `null` y el
artículo tiene `catalog_product_id`, la foto es la del CDN del supermercado y se saca del catálogo al
pintar; la foto propia siempre gana. La regla vive en `src/features/items/domain/item-image-source.ts`
y está razonada en [ADR-0014](docs/adr/ADR-0014-origen-de-la-foto-del-articulo.md), que matiza el
apartado 2 de ADR-0012 (decía lo contrario y se rompía en cuanto alguien fotografiaba un artículo
venido del catálogo).

Y una tercera que condiciona la UI antes de que exista: **si el catálogo acaba trayendo datos de
Open Food Facts, la pantalla que los enseñe lleva atribución visible.** Su base de datos es ODbL 1.0
y sus fotos CC-BY-SA, así que citar la fuente no es cortesía, es la condición de uso. La cláusula de
compartir-igual de ODbL solo se activaría si distribuyéramos la base derivada: publicar la app que
consulta nuestra copia no la activa, ofrecer `catalog_products` como export o API sí, y ese día deja
de ser una decisión técnica. Comprobado en sus términos el 2026-08-07; el detalle y qué cuesta cada
fuente, en `docs/guias/fuentes-de-datos-del-catalogo.md`.

---

## Comandos

```bash
# Desarrollo
npx expo start                 # QR para Expo Go; 'a' = Android emulador, 'i' = iOS Simulator (Mac)
npx expo start --tunnel        # si el móvil y el PC no están en la misma Wi-Fi

# Calidad
npm run lint
npm run typecheck
npm test
npm run test:coverage          # dominio y data; el umbral del 70% está en jest.config.js

# Tras añadir un fichero de ruta en src/app, arranca el server una vez antes del typecheck:
# .expo/types/router.d.ts lo genera el dev server, no `expo export`, y hasta entonces tsc
# falla con "is not assignable to type RelativePathString".
npx expo start

# Tipos de Supabase (--linked, contra el proyecto remoto; --local necesita Docker)
# Desde Git Bash. En PowerShell 5.1 el '>' escribe UTF-16 y rompe ESLint: ver skill supabase-data
npx supabase gen types typescript --linked > src/shared/lib/db.types.ts

# Aislamiento entre comunidades (RLS + Storage + rotación del código), y lectura y búsqueda del
# catálogo, que es la única tabla compartida. Debe dar 37/37
# (36/37 si no hay SUPABASE_SECRET_KEY en .env: sin ella no se puede envejecer un código)
npm run test:rls

# Realtime: eventos, filtro por comunidad, aislamiento y presencia. Debe dar 12/12
npm run test:realtime

# Fuentes del catálogo (RF-10): cuántos artículos reales encuentra cada una.
# Los flags SOLO llegan desde Git Bash; PowerShell 5.1 se come el '--' sin avisar.
npm run catalog:benchmark
npm run catalog:benchmark -- --source hf --limit 20

# Ingesta del catálogo. Clona el dataset y hace upsert por lotes con la secret key.
# Idempotente: correrlo dos veces deja las mismas filas. --dry-run no escribe ni necesita clave.
npm run catalog:ingest -- --dry-run
npm run catalog:ingest

# Usuarios de auth: cuántos hay y cuáles son huérfanos (anónimos sin fila en members)
npm run users
npm run users -- --delete-orphans   # limpieza; ver aviso en el propio script

# E2E. Necesita el CLI de Maestro (no es dependencia de npm), adb y el APK instalado.
# Con Expo Go no funciona: los flujos declaran el appId de la app. Cada ejecución deja una
# lista real en Supabase. Todo el detalle en docs/guias/e2e-con-maestro.md
npm run test:e2e
```

---

## Qué NO hacer

- No duplicar server state en Zustand.
- No importar Supabase/React dentro de `domain/`.
- No poner la secret/service key en el cliente ni en el repo.
- No mutar sin optimistic UI + rollback.
- No añadir controles sin label de accesibilidad, contraste AA y target ≥ 44 pt.
- No editar código sin enseñarme antes el plan.
- No tomar una decisión "sobre la marcha" y dejarla solo dicha en el chat.
- **No commitear ni hacer push. Nunca.** Ver abajo.

## Quién publica en el repo

**Los `git commit` y los `git push` los hago yo, Alejandro. Claude no.** Prepara los cambios en el
árbol de trabajo, dime qué hay que commitear y con qué mensaje, y paro yo. Si me va bien lanzarlo sin
salir de la sesión, uso `! git commit -m "..."` desde el prompt.

No es una norma de honor: la impone el harness. `.claude/settings.json` (que se commitea, así que
viaja con el repo) tiene un hook `PreToolUse` que corre `scripts/block-git-write-commands.mjs` y
deniega cualquier `git commit` o `git push`, incluidos los escondidos en un `cd foo && git commit` o
tras un `-C`. Detrás hay un `permissions.deny` de refuerzo y un `attribution` vacío para que no
vuelvan a colarse trailers de coautoría.

Todo lo demás de git sigue disponible: `status`, `log`, `diff`, `stash`, ramas. Solo se cierra la
puerta a publicar. Razonado en `docs/phases/fase-5.md`, apartado "Auditoría del historial y quién
puede commitear", junto con la auditoría de secretos que salió limpia y las dos trampas de Windows
que aparecieron al reescribir el historial.
