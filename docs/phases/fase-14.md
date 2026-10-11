# Fase 14: Modo Supermercado y Agrupación por Categorías/Pasillos (RF-16)

- **Fecha:** 2026-09-07
- **Estado:** Completada y verificada
- **Commit:** Pendiente de consolidación por el usuario

---

## 1. Contexto y Objetivos

El requisito RF-16 del roadmap y la especificación de funcionalidades establecen:
*«Facilitar la experiencia en la tienda física organizando los artículos por pasillos de supermercado y ofreciendo un modo de compra enfocado que impida el bloqueo de pantalla y optimice la usabilidad con una sola mano».*

### Objetivos Principales:
1. **Categorización Estándar e Inteligente de Artículos**:
   - 10 categorías/pasillos universales de supermercado (`fruits_vegetables`, `dairy_eggs`, `meat_fish`, `bakery`, `pantry`, `drinks`, `frozen`, `cleaning_home`, `personal_care`, `other`).
   - Motor de inferencia automática léxica en español con soporte para compuestos semánticos y prioridad de sustantivo núcleo inicial en construcciones «X de Y» (evitando falsos positivos).
   - Selector visual accesible para modificar o asignar categoría en alta (`AddItemBar`) y edición (`EditItemDialog`).
2. **Agrupación por Pasillos en la Lista Principal (`ItemsScreen`)**:
   - Agrupación opcional visual de la lista pendiente por pasillo mediante `groupItemsByAisle`.
   - Orden lógico secuencial típico de supermercado con emojis y conteo de artículos pendientes por pasillo.
3. **Modo Supermercado ("En la Tienda") (`/shopping-mode`)**:
   - Pantalla dedicada para la compra en la tienda física accesible mediante el botón «🛒 Modo Compra».
   - Bloqueo de suspensión de pantalla (`useKeepAwakeSafe` con `expo-keep-awake`) para evitar el bloqueo durante la compra.
   - Usabilidad ergonómica para una sola mano con filas táctiles grandes (≥60pt).
   - Indicador de progreso con porcentaje y barra visual en tiempo real.
   - Filtro segmentado: «Por comprar», «En el carro», «Todos».
   - Diálogo seguro de confirmación antes de finalizar y volver a la lista.

---

## 2. Implementación Técnica

### A. Base de Datos en Supabase
- **Migración**: `supabase/migrations/20260907180000_item_categories.sql`.
- **Columna `items.category`**: Campo `text not null default 'other'` con restricción `item_category_check`.
- **Actualización de Tipos**: Regenerado `src/shared/lib/db.types.ts` con la columna `category` tipada.

### B. Capa de Dominio (`src/features/items/domain/`)
- `item-category.ts`:
  - Definición del tipo unión `ItemCategory` con 10 categorías.
  - Constante de metadatos `ITEM_CATEGORIES` con claves de i18n, emojis e índices de orden de pasillo.
  - Función `inferItemCategory(name)` con análisis sintáctico por prioridad léxica.
  - Función `groupItemsByAisle(items)` para generación de estructuras `SectionListData`.
- `item.ts`, `item-repository.ts`, `add-item.ts`, `edit-item.ts`:
  - Campo `category` integrado en todas las entidades e interfaces del repositorio.
  - Fallback automático a inferencia semántica si no se proporciona categoría explícita.
- Tests unitarios: `item-category.test.ts`, `add-item.test.ts`, `edit-item.test.ts`.

### C. Capa de Datos (`src/features/items/data/`)
- `supabase-item-repository.ts`:
  - Soporte de `category` en columnas de consulta, mapper `toItem`, inserción individual y masiva (`add`, `addMany`) y edición (`edit`).
- Actualizado `supabase-item-repository.test.ts`.

### D. Integración en Recetas y Menús Semanales
- `use-add-recipe-to-list.ts` & `use-add-meal-plan-to-list.ts`:
  - Asignación automática de categoría inferida a los ingredientes agregados a la lista de la compra.

### E. Capa de Presentación (`src/features/items/presentation/`)
- `CategoryPickerModal.tsx`:
  - Modal selector con los 10 pasillos, iconos y comprobación activa, utilizando `@/shared/ui/Dialog` conforme a ADR-0004.
- `AddItemBar.tsx`:
  - Chip selector de categoría interactivo con auto-detección según el texto escrito y soporte de cambio manual.
- `EditItemDialog.tsx`:
  - Selector de pasillo/categoría con preselección del valor actual del artículo.
- `ItemsScreen.tsx`:
  - Botón de acceso directo «🛒 Modo Compra» en la barra de herramientas superior.
  - Interruptor de agrupación por pasillos para ordenar los artículos por sección.
- `ShoppingModeScreen.tsx`:
  - Pantalla completa de modo supermercado con `useKeepAwakeSafe`, barra de progreso visual, pestañas de filtrado, secciones por pasillo y diálogo de salida.
- `src/app/shopping-mode.tsx`:
  - Ruta de Expo Router configurada.
- Tests de presentación: `shopping-mode-screen.test.tsx` (4 tests pasando con cobertura completa).

### F. Internacionalización (`src/shared/lib/i18n/`)
- Traducidas todas las categorías, opciones de modo supermercado, diálogos y filtros en `es.json` y `en.json`.
- Validación de paridad al 100% en `translations.test.ts`.

---

## 3. Verificación y Resultados

1. **Pruebas Unitarias y de Integración**:
   - `npm test`: **60 suites pasadas, 431 tests pasando**.
2. **Chequeo de Tipos**:
   - `npm run typecheck`: **0 errores**.
2. **Análisis Estático (Lint)**:
   - `npm run lint`: **0 errores y 0 avisos**.
3. **Pruebas de Seguridad RLS en Supabase**:
   - `npm run test:rls`: **65/65 comprobaciones correctas**.
4. **Empaquetado Android de Producción**:
   - `npx expo export --platform android`: **Éxito (7.44 MB hbc bundle, 0 errores)**.

---

## Utillaje · Agentes del proyecto y `pr-review-toolkit` (2026-10-11)

No es un incremento de la fase, es una decisión de herramienta, como la de plugins del 2026-08-05
(`docs/phases/fase-5.md`, «Utillaje · Qué plugins de Claude Code usa el repo»). Se escribe aquí
porque es el diario abierto más reciente.

### Qué se cambió

1. **`eslint.config.js` cubre las ocho features.** El array `features` tenía cinco; faltaban
   `meal-planner`, `notifications` y `recipes`.
2. **Tres agentes propios en `.claude/agents/`**: `architecture-guard`, `migration-reviewer` y
   `docs-drift-auditor`. De solo lectura (`tools: Read, Grep, Glob, Bash`), los dos primeros con la
   skill del área precargada por el campo `skills:` del frontmatter.
3. **Plugin oficial `pr-review-toolkit`** declarado en `.claude/settings.json`, instalado con
   `claude plugin install pr-review-toolkit@claude-plugins-official --scope project`.
4. **Regla nueva en `CLAUDE.md`** (punto 6 del flujo de trabajo): el plan de cada fase trae los
   prompts de cada incremento, y cada prompt nombra al agente que le toca.

### Por qué

**El hueco del lint.** El bucle de `eslint.config.js` genera un bloque de `no-restricted-imports`
por cada feature de la lista y nada para las demás. Las tres features de las fases 10 a 12 se
crearon sin añadirse, así que estuvieron sin la regla de pureza de `domain/` y sin la puerta de
`index.ts`, con `npm run lint` en verde. Al añadirlas el lint siguió limpio: no había ninguna
violación dentro, pero tampoco nada que la hubiera impedido. Sonda del 2026-10-11, con cinco
ficheros temporales ya borrados: disparan `react` en `recipes/domain`, `@supabase/supabase-js` en
`items/domain`, un import al interior de `items` desde `meal-planner`, y Paper más un import al
interior de `recipes` desde un `.tsx` de `notifications`. Las reglas viejas siguen vivas y las
nuevas existen.

**Agentes propios y no una colección.** Se miraron las colecciones conocidas el 2026-10-11:
`wshobson/agents` (40k estrellas), `VoltAgent/awesome-claude-code-subagents` (25k),
`obra/superpowers` y `affaan-m/ECC`. Se descartan por dos motivos. El primero es la regla de «solo
marketplace oficial», que sigue en pie. El segundo pesa más: son genéricos. El
`expo-react-native-expert` de VoltAgent asume «SDK 52+» y config plugins, y no sabe nada del SDK
fijado en 54, de `assertOnline()` ni de ningún ADR; un revisor así propone lo contrario de lo que
este repo ha decidido por escrito. Un agente nuestro es un markdown commiteado que carga `CLAUDE.md`
solo y precarga la skill del área, así que revisa contra las reglas de aquí. A cambio hay que
mantenerlo: si cambia una regla, se cambia en el agente.

**`docs-drift-auditor` cubre la deuda que dejó `sync-docs`.** `fase-5.md` la dejó anotada como
abierta. Hoy es visible: `CLAUDE.md` dice «Fase actual: 6» y `test:rls` 39/39, con el repo en la
Fase 14 y 65/65, y los diarios de las fases 7 a 14 tienen unas 90 líneas frente a las 600–1.600 de
los anteriores. **Esa puesta al día no se ha hecho en este cambio**; es lo primero que hay que
pedirle al agente.

**`pr-review-toolkit` sí entra** porque es de Anthropic y está en el marketplace oficial. Aporta
agentes que no dependen de conocer el proyecto: `silent-failure-hunter` (el fallo que ADR-0016
existe para evitar), `type-design-analyzer` (las uniones discriminadas de los casos de uso) y
`pr-test-analyzer`. Trae también un `code-reviewer` y un `code-simplifier` genéricos; para revisar
contra las reglas del repo se usa `architecture-guard`, no esos.

### Qué se miró y se dejó fuera

- `feature-dev` (oficial): sus `code-explorer` y `code-architect` solapan con los agentes Explore y
  Plan que ya trae Claude Code.
- `commit-commands` (oficial): hace commits y push, lo contrario de «Quién publica en el repo».
- `superpowers`: ahora está en el marketplace oficial, pero el motivo del 2026-08-05 no era ese, era
  que trae su propio flujo de trabajo. Sigue fuera.
- `security-guidance`, `hookify` (oficiales): el primero instala dependencias de Python al arrancar
  cada sesión y `/security-review` ya viene de serie; el segundo genera hooks, y los de este repo se
  escriben a mano en `scripts/`.
- `callstack/agent-device` (4,9k estrellas, de Callstack): CLI por ADB con árbol de accesibilidad,
  capturas y logs, que exporta a YAML de Maestro. Es el sustituto serio del
  `android-emulator-qa-plugin` apuntado en `fase-5.md`. No es un plugin sino un paquete de npm, y no
  se pudo confirmar que funcione con Expo Go ni en Windows. Queda apuntado, no instalado.
- `callstackincubator/agent-skills`: su skill `react-native-testing` documenta la API de RNTL v14,
  que es la que usa el repo. Fuera del marketplace oficial.

### Pendiente de decidir

- **Plugin `sentry`.** Se descartó el 2026-08-05 porque Sentry estaba fuera del alcance. Desde
  ADR-0019 es una dependencia, así que el motivo caducó. No se ha instalado: es decisión del usuario.
- **La skill del plugin `expo` que recomienda subir de SDK** se llama `expo-upgrade` en
  `expo/skills` a fecha de hoy; `CLAUDE.md` la nombra como `upgrading-expo`. No se ha comprobado qué
  nombre lleva la versión instalada.
- **`src/theme/index.ts` importa `MD3DarkTheme` y `MD3LightTheme` de `react-native-paper`**, fuera
  de `src/shared/ui`. La regla de lint de Paper solo cubre `.tsx`, así que no lo ve. Puede ser
  legítimo (el tema de Paper se construye desde los tokens), pero entonces la excepción falta en
  ADR-0004 o en `CLAUDE.md`.

### Cómo probarlo

1. `npm run lint` → limpio.
2. Reiniciar Claude Code en el repo; `/agents` debe listar los tres del proyecto y los seis de
   `pr-review-toolkit`.
3. Pedir «usa docs-drift-auditor sobre CLAUDE.md»: debe devolver, como mínimo, la fase actual y el
   recuento de `test:rls`.
