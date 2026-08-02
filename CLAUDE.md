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
- **Estado servidor:** TanStack Query (caché, refetch, mutaciones, optimistic updates).
- **Estado cliente:** Zustand (sesión local, tema, UI). **Nunca dupliques el estado del servidor en Zustand.**
- **Backend (BaaS):** Supabase → Postgres + Realtime + Storage + RLS.
- **UI:** NativeWind (Tailwind para RN) + componentes propios en `src/shared/ui`. Tokens de diseño en `src/theme`.
  - **React Native Paper solo para `Snackbar`, `Dialog` y `Portal`.** Nada más. El aspecto de la app es nuestro; Paper aporta las superposiciones accesibles, que son las que cuesta hacer bien a mano. Un import de `react-native-paper` fuera de `src/shared/ui` es un error de revisión. Razonado en [ADR-0004](docs/adr/ADR-0004-libreria-de-ui.md).
- **Persistencia local:** react-native-mmkv. **Conectividad:** @react-native-community/netinfo.
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

| Carpeta | Contiene |
|---|---|
| `docs/especificacion-y-roadmap.md` | El documento maestro. Referencia. |
| `docs/adr/` | Por qué las cosas son como son. Numerados, y **no se editan**: si cambias de opinión, escribe uno nuevo que supersede al viejo. |
| `docs/phases/` | Diario por fase: qué se hizo, cómo probarlo, deuda asumida. |
| `docs/guias/` | Instrucciones paso a paso para tareas concretas. |

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

## Reglas de UX y accesibilidad (no negociables)

- Pensado para **usuario novato**: una acción principal grande y evidente por pantalla; feedback inmediato; **"deshacer"** tras borrar; valores por defecto sensatos (cantidad = 1).
- Cada control nuevo: `accessibilityLabel` + `accessibilityRole`, **contraste AA**, área táctil **≥ 44×44 pt**.
- Estados no dependientes solo del color (icono + texto para "comprado").
- Soporta **modo claro/oscuro** desde los tokens y respeta el tamaño de fuente del sistema.

## Reglas de datos y sincronización

- Fuente de verdad = Supabase. Cada cliente **se suscribe a Realtime** de su `community_id`; los eventos reconcilian la caché de TanStack Query.
- Los cambios se propagan entre redes/países porque todos hablan con el mismo backend (no entre sí).
- Offline pragmático: última lista cacheada (TanStack persist + MMKV); mutaciones encoladas y reenviadas al reconectar (NetInfo). Conflictos simples → last-write-wins por `updated_at`.
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

| Skill | Consúltala para |
|---|---|
| `expo-stack` | Cualquier cosa dentro de `src/`: capas, estado, mutaciones, Realtime, offline, a11y |
| `supabase-data` | Esquema, RLS, RPCs, Realtime, `db.types.ts`, claves |
| `qa-runner` | Cerrar un incremento o una fase |

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

| Tipo de decisión | Dónde se escribe |
|---|---|
| Arquitectura, seguridad, modelo de datos, elección de librería | ADR nuevo en `docs/adr/`, numerado |
| Detalle de implementación de una regla que ya existe (un `with check`, un índice, un grant) | La skill del área, junto al código de ejemplo |
| Qué se hizo en este incremento y cómo probarlo | `docs/phases/fase-N.md` |
| Procedimiento repetible que alguien tendrá que volver a ejecutar | `docs/guias/<tarea>.md` |
| Regla que debo seguir siempre a partir de ahora | Este fichero |

Si una decisión no encaja en ninguna, va en `docs/phases/fase-N.md` bajo "Decisiones sobre la
marcha". Nunca se queda sin escribir.

**Fase actual: FASE 3 (imágenes y pulido UX).** Las fases 0, 1 y 2 están cerradas y probadas en
el APK con dos dispositivos; su diario está en `docs/phases/`. Cuando termines la 3 y pase su
auditoría (sección 11 del `.md`, apartado F), pídeme luz verde para la Fase 4.

La versión que corre en el móvil se ve al pie de la pantalla de lista (`v1.0.0 · base` si es el
bundle del APK, `v1.0.0 · <id>` si es un update por aire). Compruébala ahí antes de dar por
hecho que un cambio llegó al dispositivo.

RF-8 (PDF) y RF-9 (reparto de gastos) son **post-MVP**: están registrados en §3 y §12 del
documento maestro y no se tocan antes de tiempo. El reparto de gastos además tiene un
requisito de entrada, ver [ADR-0005](docs/adr/ADR-0005-reparto-de-gastos.md).

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

# Tras añadir un fichero de ruta en src/app, arranca el server una vez antes del typecheck:
# .expo/types/router.d.ts lo genera el dev server, no `expo export`, y hasta entonces tsc
# falla con "is not assignable to type RelativePathString".
npx expo start

# Tipos de Supabase (--linked, contra el proyecto remoto; --local necesita Docker)
# Desde Git Bash. En PowerShell 5.1 el '>' escribe UTF-16 y rompe ESLint: ver skill supabase-data
npx supabase gen types typescript --linked > src/shared/lib/db.types.ts

# Aislamiento entre comunidades (RLS). Debe dar 13/13
npm run test:rls

# Realtime: eventos, filtro por comunidad, aislamiento y presencia. Debe dar 12/12
npm run test:realtime

# Usuarios de auth: cuántos hay y cuáles son huérfanos (anónimos sin fila en members)
npm run users
npm run users -- --delete-orphans   # limpieza; ver aviso en el propio script
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
