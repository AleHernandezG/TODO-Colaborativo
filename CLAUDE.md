# Proyecto: Lista de la Compra Colaborativa

App móvil donde varias personas comparten UNA lista de la compra por comunidad,
sincronizada en tiempo real aunque estén en redes y países distintos. Acceso por
código de invitación + nombre de usuario (sin cuentas, versión beta).

> Especificación completa (léela antes de decisiones grandes):
> `docs/COMPRA-COLABORATIVA-Especificacion-y-Roadmap.md`
> Trabaja SIEMPRE por fases (0 → 4). No saltes de fase sin cerrar la anterior.

---

## Stack

- **Expo (React Native)** + **Expo Router** (navegación por ficheros) + **TypeScript (strict)**.
  - Al crear el proyecto se eligió la opción **compatible con la versión de Expo Go de la App Store** (para poder probar en iPhone sin `eas go`). No subas el SDK por encima de esa versión sin avisarme.
- **Estado servidor:** TanStack Query (caché, refetch, mutaciones, optimistic updates).
- **Estado cliente:** Zustand (sesión local, tema, UI). **Nunca dupliques el estado del servidor en Zustand.**
- **Backend (BaaS):** Supabase → Postgres + Realtime + Storage + RLS.
- **UI:** NativeWind (Tailwind para RN) + componentes propios en `src/shared/ui`. Tokens de diseño en `src/theme`.
- **Persistencia local:** react-native-mmkv. **Conectividad:** @react-native-community/netinfo.
- **Imágenes:** expo-image, expo-image-picker, expo-image-manipulator (comprimir antes de subir).
- **Sesión ligera cifrada:** expo-secure-store.
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

---

## Reglas de arquitectura (duras)

- **`domain/` no importa NADA de React ni de Supabase.** Verifícalo (los casos de uso son funciones puras y testeables).
- **Repositorios como puertos + adaptador:** el dominio define una interfaz; `data/` la implementa para Supabase. Cambiar de proveedor = crear otro adaptador, sin tocar `domain/`.
- La UI depende de **hooks/casos de uso**, nunca de Supabase directamente.
- Componentes de `shared/ui` **presentacionales**: reciben props, no conocen la lógica de datos.

## Reglas de estado

- Server state **solo** en TanStack Query. Client state (tema, sesión, UI) en Zustand.
- Toda mutación con **actualización optimista + rollback** ante error de red (+ aviso discreto, snackbar).

## Reglas de UX y accesibilidad (no negociables)

- Pensado para **usuario novato**: una acción principal grande y evidente por pantalla; feedback inmediato; **"deshacer"** tras borrar; valores por defecto sensatos (cantidad = 1).
- Cada control nuevo: `accessibilityLabel` + `accessibilityRole`, **contraste AA**, área táctil **≥ 44×44 pt**.
- Estados no dependientes solo del color (icono + texto para "comprado").
- Soporta **modo claro/oscuro** desde los tokens y respeta el tamaño de fuente del sistema.

## Reglas de datos y sincronización

- Fuente de verdad = Supabase. Cada cliente **se suscribe a Realtime** de su `community_id`; los eventos reconcilian la caché de TanStack Query.
- Los cambios se propagan entre redes/países porque todos hablan con el mismo backend (no entre sí).
- Offline pragmático: última lista cacheada (TanStack persist + MMKV); mutaciones encoladas y reenviadas al reconectar (NetInfo). Conflictos simples → last-write-wins por `updated_at`.

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
4. **Documenta:** actualiza `docs/phases/fase-N.md` (qué hiciste, decisiones, cómo probar) y crea un ADR en `docs/adr/` si tomaste una decisión de arquitectura.
5. No inventes claves ni valores; pídemelos si faltan. No hagas commits de secretos.

**Fase actual: FASE 0 (cimientos).** Cuando la termines y pase su auditoría
(sección 11 del `.md`), pídeme luz verde para la Fase 1.

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

# Tipos de Supabase
supabase gen types typescript --local > src/shared/lib/db.types.ts
```

---

## Qué NO hacer

- No duplicar server state en Zustand.
- No importar Supabase/React dentro de `domain/`.
- No poner la secret/service key en el cliente ni en el repo.
- No mutar sin optimistic UI + rollback.
- No añadir controles sin label de accesibilidad, contraste AA y target ≥ 44 pt.
- No editar código sin enseñarme antes el plan.
