# Estructura

Dónde va cada cosa y dónde poner un fichero nuevo. El criterio está en
[ADR-0003](../adr/ADR-0003-estructura-del-repositorio.md) (una sola app, sin monorepo) y en
[ADR-0027](../adr/ADR-0027-metodo-de-trabajo-con-paquetes-y-hooks.md) (`docs/plan/` y
`docs/tecnica/`). No se añaden carpetas a la raíz sin un ADR.

## La raíz

```text
CLAUDE.md          el contrato de cada sesión
DESIGN.md          cómo se ve la app
README.md          qué es y cómo se arranca
.env.example       nombres de variables, sin valores
.claude/           settings.json, hooks/, skills/, agents/ (todo a git salvo settings.local.json)
.maestro/          flujos E2E
.github/           la Action semanal del catálogo
assets/            iconos y splash
docs/              ver abajo
scripts/           herramientas de CLI y CI, fuera del bundle
supabase/          migraciones y config de la CLI
src/               el código de la app
```

## `src/`

```text
src/
├── app/            rutas de Expo Router. Una ruta renderiza una screen de una feature
├── features/<x>/
│   ├── index.ts    la única puerta de la feature
│   ├── domain/     entidades y casos de uso. Sin React, Supabase ni Expo
│   ├── data/       puerto + adaptador de Supabase
│   └── presentation/  screens/ components/ hooks/ stores/ mutations/
├── shared/
│   ├── ui/         componentes presentacionales y Paper
│   ├── hooks/      hooks de React sin nada de ninguna feature
│   └── lib/        clientes, i18n, tipos generados, envoltorios de módulos nativos
└── theme/          tokens
```

Las capas, de dentro a fuera: `domain ← data ← presentation ← app`. `domain/` es la capa pura; lo
vigilan el lint (`no-restricted-imports`) y el hook `comprobar-nucleo.mjs`.

## `docs/`

| Carpeta | Contiene |
| --- | --- |
| `docs/especificacion-y-roadmap.md` | El documento maestro de producto. Referencia |
| `docs/plan/` | `ROADMAP.md` con el bloque «Estado», `PREGUNTAS.md` y `prompts/` (`T-NN.md`; `T-NN-<n>-<tema>.md` si el paquete lleva un prompt por incremento, y `T-NN-<tema>.md` para uno suelto, como `T-15-gastos.md`) |
| `docs/tecnica/` | Este fichero, `STACK.md`, `GLOSARIO.md` y `METODO-DE-TRABAJO.md` |
| `docs/adr/` | Decisiones, `ADR-NNNN-...md`. No se editan una vez aceptadas |
| `docs/phases/` | El diario de cada fase o paquete |
| `docs/guias/` | Procedimientos paso a paso |
| `docs/diseno/` | Lo medido de las pantallas en el móvil: `estado-de-partida.md` (T-16.1) y, desde el T-16.2, el diseño. Las capturas y los XML no van aquí sino a `~/tools/capturas/<aaaa-mm>/`, fuera del repo |

## `scripts/`

| Carpeta | Contiene |
| --- | --- |
| `scripts/*.mjs` | Las órdenes de `package.json`: ingesta y medición del catálogo, `test:rls`, `test:realtime`, `users`, `inspect:screen` |
| `scripts/lib/` | La lógica pura de un script, en TypeScript para que Jest la pruebe (la cobertura de `jest.config.js` no la cuenta: mide `domain/` y `data/`). El `.mjs` hace la E/S (adb, red, disco) y la importa; Node la carga con `--experimental-strip-types` |
| `scripts/__tests__/` | Los tests de `scripts/lib/`. Jest los recoge como los de `src/` |
| `scripts/__fixtures__/` | Entradas reales grabadas para esos tests, como el árbol de uiautomator de la cabecera aplastada |

## Dónde pongo un fichero nuevo

| Es... | Va en |
| --- | --- |
| Una pantalla nueva | la ruta en `src/app/` y el cuerpo en `src/features/<x>/presentation/screens/` |
| Una regla de negocio | una función pura en `src/features/<x>/domain/`, con su test en `__tests__/` al lado |
| Una llamada a Supabase | un método del puerto en `domain/` y su implementación en `data/`, empezando por `assertOnline()` |
| Una mutación que se pueda encolar | su `setMutationDefaults` en `presentation/mutations/` |
| Un componente que se usa en dos features | `src/shared/ui/` si es presentacional; si conoce datos, se queda en una feature y la otra lo importa por su `index.ts` |
| Un envoltorio de un módulo nativo | `src/shared/lib/` |
| Un doble de test que usan varias features | `src/shared/lib/__fixtures__/`, fuera de la cobertura por `jest.config.js`; es una subcarpeta de `lib/`, no una cuarta de `shared/`. El de una sola carpeta, en su `__fixtures__/` al lado |
| Una feature nueva | `src/features/<x>/` y, en el mismo cambio, su nombre en el array `features` de `eslint.config.js` (lo vigila `repository-rules.test.ts`) |
| Un texto de pantalla | `src/shared/lib/i18n/es.json` y `en.json` a la vez |
| Un color, tamaño o radio | `src/theme/tokens.js` y su papel en `DESIGN.md` |
| Un cambio de esquema | una migración nueva en `supabase/migrations/`, con el diseño aprobado antes |
| Un script de mantenimiento | `scripts/`, en `.mjs`, con imports relativos (Node no resuelve el alias `@/`). Si tiene lógica que merezca un test, esa parte va en `scripts/lib/<x>.ts`, sin imports de Node, y el `.mjs` hace la E/S |
| Una decisión | `docs/adr/` con la skill `adr` |
| Un procedimiento repetible | `docs/guias/` |
| Una pieza de Claude Code | `.claude/skills/`, `.claude/agents/` o `.claude/hooks/`, apuntada en `METODO-DE-TRABAJO.md` |
