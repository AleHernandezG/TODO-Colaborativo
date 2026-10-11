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

## 4. Decisiones sobre la marcha

### Referencias externas de diseño: qué entra y qué no (2026-10-05)

**Qué se cambió.** Se revisaron ocho herramientas y skills pensadas para que un agente haga mejor
interfaz, por si alguna merecía entrar en el repo. No se instaló ninguna. Lo que salió de la
revisión son dos documentos propios:

- [`DESIGN.md`](../../DESIGN.md) en la raíz, con el papel de cada color, la escala de texto, los
  radios, el espaciado y la lista de lo que no se hace. Sale de `src/theme/tokens.js` y de contar
  las clases que usa `src/` hoy.
- Una sección nueva, "Pulido visual y movimiento", en la skill `expo-stack`, con las reglas de
  animación, respuesta al pulsar, radio concéntrico, alineación óptica y cifras tabulares escritas
  para Reanimated y NativeWind.

`CLAUDE.md` gana una línea en las reglas de UX que obliga a leer `DESIGN.md` antes de pintar, y otra
en el reparto de la raíz.

**Por qué.** La skill `expo-stack` no decía nada del aspecto ni del movimiento, solo de
accesibilidad, así que cada pantalla nueva improvisaba. El recuento lo confirma: cuatro opacidades
distintas para el estado pulsado, dos radios que no están en los tokens y una sola sombra en toda la
app.

Lo revisado y el motivo de cada descarte:

| Referencia                    | Decisión                 | Motivo                                                                                                                                                                                |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| make-interfaces-feel-better   | Adaptada, no instalada   | De sus 19 reglas unas 10 valen sin DOM. El resto es CSS (`text-wrap`, `will-change`, `transition: all`) y aquí sería ruido. Es MIT y la skill cita la fuente.                         |
| Awesome DESIGN.md             | Se copia el formato      | Los 55 ficheros describen el aspecto de webs de terceros. Copiar uno contradice ADR-0004, que dice que el aspecto de la app es nuestro. El formato de documento sí sirve.             |
| taste-skill                   | Descartada               | Todo web. Su variante móvil genera imágenes de maquetas, no código. Empuja a layouts llamativos, lo contrario de una acción principal evidente para un usuario novato.                |
| Impeccable                    | Descartada               | Su detector analiza HTML y CSS y no ve nada en un árbol de NativeWind. Instala hooks que ejecutan código en cada edición.                                                             |
| Playwright CLI                | Descartada               | Automatiza un navegador y esta app se verifica en un Android real. Los E2E ya son de Maestro.                                                                                         |
| gsap-skills                   | Descartada               | GSAP anima el DOM. No corre en React Native.                                                                                                                                          |
| transitions.dev               | Descartada               | Transiciones CSS y de React web, con un agente de pago. Vale como catálogo para mirar qué se suele animar.                                                                            |
| img2threejs                   | Descartada               | Reconstruye objetos en Three.js. No hay 3D en esta app.                                                                                                                               |

La alternativa de instalar make-interfaces-feel-better con `npx skills add` se descartó por dos
cosas: metía en contexto nueve reglas que no aplican, y es código de un tercero fuera del
marketplace oficial, que es justo lo que la sección "Plugins de Claude Code" de `CLAUDE.md` cierra.
El coste de adaptarla es que no recibe las mejoras del original; si su autor añade reglas, hay que
mirarlas a mano.

Dos decisiones de aspecto se tomaron al escribir los documentos, porque el código no era coherente y
había que fijar una:

- El estado pulsado es `active:opacity-70`, y `active:opacity-80` en botones con relleno. La escala
  a 0.96 queda solo para tarjetas enteras que se pulsan.
- La app no usa sombras. Las superficies se separan por color y por borde.

**Qué implica.** `DESIGN.md` se mantiene a mano: quien cambie `tokens.js` actualiza sus tablas en el
mismo cambio, y si discrepan mandan los tokens. Su último apartado, "Lo que hoy no cumple", lista lo
que el código ya tenía en contra de estas reglas; no se ha tocado ningún componente en este cambio,
así que esa lista es deuda abierta. Las reglas de movimiento no se han visto en dispositivo porque
no hay código nuevo que las use: la primera pantalla que aplique la escala al pulsar es la que las
valida en el Android real.

### Arreglo de lo que `DESIGN.md` listaba como incumplido (2026-10-05)

**Qué se cambió.** Los cuatro puntos del apartado "Lo que hoy no cumple", en 17 ficheros de `src/`
y sin tocar lógica:

- Los nueve radios fuera de los tokens pasan a `rounded-lg` (tarjetas y portadas de receta) o a
  `rounded-md` (los huecos de comida y cena del planificador, que son controles). La miniatura de la
  tarjeta de receta baja a `radius.sm` para seguir siendo concéntrica con su tarjeta, que ahora mide
  16 con 12 de padding.
- El estado pulsado queda en `active:opacity-70` en todo lo que no es un `Button`.
- Se quita el `shadow-sm` del planificador.
- Importes, cantidades y progreso llevan números tabulares con un token nuevo, `tabularNums`,
  exportado desde `src/theme/index.ts`. Lo usan los importes de gastos, el `×N` de la lista y del
  modo compra, el porcentaje de progreso, la cantidad del volcado de menús y `QuantityStepper`.

**Por qué.** `tabularNums` es un objeto de estilo y no una clase porque NativeWind no convierte
`font-variant-numeric`: se comprobó en `react-native-css-interop`, que solo conoce
`font-variant-caps`. Va en `@/theme` para no repetir el literal en quince sitios. Las frases que
llevan un importe dentro ("Ha pagado 12,00 €") se dejaron sin tocar: lo que baila es una cifra sola
en una columna, no una palabra en mitad de un texto.

**Qué implica.** `npm run typecheck` y `npm test` (60 suites, 431 tests) pasan; `eslint` da los
mismos tres avisos de `set-state-in-effect` que ya había en esos ficheros. **No se ha visto en el
móvil**: son cambios de aspecto y falta mirar en el Android real el planificador, la lista de
recetas y la pantalla de gastos. El apartado de `DESIGN.md` se reescribió con tres incumplimientos
que aparecieron al hacer este y que siguen abiertos; el primero, `text-content-muted` en el
planificador, es una clase que no existe y deja ese texto con el color por defecto.

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
