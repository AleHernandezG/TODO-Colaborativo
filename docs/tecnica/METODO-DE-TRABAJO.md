# Método de trabajo con Claude Code

Cómo está montado Claude Code en este repo: qué piezas hay, qué regla hace cumplir cada una, por qué
están así y qué se miró y no entró. Se montó el 2026-10-31 a partir de `METODO-PARA-PROYECTO-NUEVO.md`
y `PIEZAS-PARA-PROYECTO-NUEVO.md`, con DietMetric como referencia, y lo razona
[ADR-0027](../adr/ADR-0027-metodo-de-trabajo-con-paquetes-y-hooks.md).

La idea de fondo: **una regla que nadie comprueba es una sugerencia.** Para cada regla, la pregunta
es quién la hace cumplir. Si la respuesta es «el modelo se acordará», hace falta un hook, un test o
un revisor.

## 1. Las capas

| Capa | Dónde vive | Qué garantiza | Quién la ejecuta |
| --- | --- | --- | --- |
| Contrato | `CLAUDE.md` y `~/.claude/CLAUDE.md` | Las reglas que no se negocian | El modelo, en cada sesión |
| Procedimientos | `.claude/skills/` | Que una tarea se haga igual la vez veinte que la primera | El modelo, al invocarla |
| Revisión | `.claude/agents/` | Un dictamen independiente sin gastar el contexto principal | Un subagente |
| Barreras | `.claude/hooks/` | Que lo prohibido no llegue a pasar | Node, fuera del modelo |
| Tests que vigilan reglas | `__tests__/` y `scripts/test-hooks.mjs` | Que la arquitectura no se erosione en silencio | Jest y Node |
| Contratos escritos | `docs/tecnica/`, `DESIGN.md`, skills | Que cada respuesta se escriba una vez | Una persona |
| Historia | `docs/adr/`, `docs/phases/` | Que nadie deshaga una decisión sin saber qué resolvía | Una persona |
| Plan | `docs/plan/` | Que cada sesión sepa por dónde va el proyecto | El hook `cargar-estado` |

## 2. Paquetes, incrementos y sesiones

Un paquete T-NN es la fase NN: mismo número y mismo diario (`docs/phases/fase-NN.md`). Dentro se
trabaja por incrementos, **uno por sesión**, cada uno con su prompt de arranque en
`docs/plan/prompts/` (o, para el T-15, en el apartado 7 de la auditoría del 2026-10-11, que ya los
tenía). Se trabaja en serie: varias sesiones a la vez inventan el mismo tipo con dos nombres y se
pisan los documentos. El coste aceptado es que un incremento atascado en una pregunta para todo.

El estado vive en el bloque «Estado» del ROADMAP, no en `CLAUDE.md`, porque allí caduca. El hook
`cargar-estado.mjs` lo imprime al abrir la sesión y tras cada `/compact`. Entre incrementos,
`/clear`: el diario y el prompt del siguiente ya son el resumen.

Las dudas que decide Alejandro van a `docs/plan/PREGUNTAS.md`, con números y opciones, y la
respuesta debajo.

## 3. Skills

En `.claude/skills/<nombre>/SKILL.md`. De cada una se carga siempre la `description`; el
procedimiento entero llega al invocarla.

| Skill | Origen | Cuándo |
| --- | --- | --- |
| `expo-stack` | Del repo, anterior al método | Cualquier cosa en `src/` |
| `supabase-data` | Del repo, anterior al método | Esquema, RLS, RPC, Realtime, tipos |
| `qa-runner` | Del repo, anterior al método | Cerrar un incremento |
| `adr` | Plantilla genérica del método, adaptada a `docs/adr/ADR-NNNN` | Una decisión con alternativas |
| `documentar-cambio` | Plantilla genérica, con la tabla de este repo | Al terminar cualquier cambio |
| `cerrar-paquete` | Plantilla genérica, con las órdenes y los revisores de aquí | Cerrar un paquete o una fase |
| `prompt-de-paquete` | Plantilla genérica, con la forma de los prompts de DietMetric y de la auditoría | Dejar listo el siguiente incremento |
| `probar-en-android` | Nueva, de `probar-app` de PIEZAS, rehecha para móvil | El guion en el Android real |
| `publicar-version` | Nueva, del patrón «skill que solo lanza Alejandro» | `eas update` o `eas build` |
| `aplicar-migracion` | Nueva, del patrón «skill que solo lanza Alejandro» | `supabase db push` y lo de antes y después |

`publicar-version` y `aplicar-migracion` llevan `disable-model-invocation: true`: la sesión no las
lanza por su cuenta, porque tienen efectos fuera del repo.

`qa-runner` no se sustituyó por `cerrar-paquete`, aunque el plan del 2026-10-31 lo proponía: la
citan los once prompts del T-15 en la auditoría y cubre bien el incremento suelto. `cerrar-paquete`
la da por pasada y añade lo del paquete.

## 4. Agentes

En `.claude/agents/`. Revisan, no arreglan, y se lanzan uno detrás de otro, nunca a la vez.

| Agente | Modelo | Si tocó |
| --- | --- | --- |
| `architecture-guard` | (el de la sesión) | `src/`. Capas, estado, errores, offline, i18n, props de accesibilidad, Paper, botón atrás |
| `revisor-interfaz` | sonnet | Una pantalla. `DESIGN.md`, estados, contraste, fuente grande, área táctil, regla 6 en pantalla |
| `migration-reviewer` | (el de la sesión) | `supabase/migrations/`, RLS, RPC, Realtime |
| `revisor-documentacion` | sonnet | Siempre, el último. El diff contra su tabla de documentos |
| `docs-drift-auditor` | (el de la sesión) | Al cerrar una fase: todo el repo contra el código |
| `investigador-datos` | haiku | No revisa: rastrea un dato de la pantalla a la tabla |

Del plugin `pr-review-toolkit` se usan `silent-failure-hunter` (manejo de errores) y
`pr-test-analyzer` (cobertura). Lo que propongan pasa por `CLAUDE.md`: `silent-failure-hunter` pide
registrar cada error con su contexto, y aquí un error lleva su código y su operación según ADR-0016,
nada más.

`revisor-interfaz` no repite lo de `architecture-guard`: ese mira que cada control tenga sus props;
este, cómo se ve y qué promete la pantalla.

## 5. Hooks

Scripts de Node en `.claude/hooks/`, configurados en `.claude/settings.json`. Node porque corre igual
en Windows y no depende del proyecto. Un bloqueo no se esquiva con otra herramienta: el mensaje dice
qué hacer en su lugar. Se prueban con `npm run test:hooks` (89 comprobaciones el 2026-10-31), que
parte las órdenes en trozos para que el hook de git no bloquee su propia prueba.

| Hook | Evento | Qué hace |
| --- | --- | --- |
| `cargar-estado.mjs` | SessionStart | Imprime el bloque «Estado» del ROADMAP |
| `bloquear-escrituras-git.mjs` | PreToolUse sobre `Bash\|PowerShell` | Deniega `git commit/push/merge/rebase/tag/cherry-pick/revert/am`, las escrituras de `gh`, `eas` salvo las de lectura (`whoami`, `*:list`, `*:view`) y `supabase db push/reset`, `migration repair`, `functions deploy` y `secrets set` |
| `proteger-intocables.mjs` | PreToolUse sobre `Write\|Edit\|MultiEdit` | Bloquea `.env*` (salvo `.env.example`), `db.types.ts`, las migraciones que ya están en git y los ADR aceptados salvo su línea `Estado:` |
| `bloquear-secretos.mjs` | PreToolUse sobre `Write\|Edit\|MultiEdit` | Bloquea escribir algo con forma de `sb_secret_`, clave privada, token de GitHub, Expo o Sentry, o una asignación larga a `apiKey`/`secret`/`token`/`password` |
| `formatear.mjs` | PostToolUse sobre `Write\|Edit\|MultiEdit` | Prettier sobre el `.ts/.tsx/.js/.mjs/.json` escrito. No toca Markdown, para no reformatear diarios enteros |
| `comprobar-nucleo.mjs` | Stop | Si cambió el contenido de algún `src/features/*/domain/`, pasa `jest --testPathPattern "features.[a-z-]+.domain."` (34 ficheros de test, unos 30 s) y no deja terminar el turno si falla. Guarda la huella SHA-256 de la última pasada buena en `.claude/.ultima-verificacion-nucleo`, fuera de git |

El hook de git sustituye a `scripts/block-git-write-commands.mjs`, que solo miraba `commit` y
`push`. El de la fase 5 está contado en su diario; el script viejo se borró el 2026-10-31.

La extensión a `eas` y `supabase` no está en el método: salió de este proyecto. Publicar un update o
aplicar una migración llega a los móviles o a la base de otras personas, que es lo mismo que un push
pero peor de deshacer.

## 6. Tests que vigilan reglas

| Test | Regla |
| --- | --- |
| `src/shared/lib/i18n/__tests__/forbidden-claims.test.ts` | Regla 6: ningún texto dice que algo está sincronizado o guardado en el servidor, ni presenta un precio como actual; el aviso de orientativo y la antigüedad del precio siguen existiendo |
| `src/shared/lib/i18n/__tests__/translations.test.ts` | Español e inglés con las mismas claves, placeholders y plurales |
| `src/shared/lib/__tests__/repository-rules.test.ts` | Cada carpeta de `src/features/` está en el array `features` del lint, tiene `index.ts` y no deja ficheros sueltos en `presentation/` |
| `eslint.config.js` | Pureza de `domain/`, puerta por `index.ts`, Paper solo en `shared/ui` |
| `npm run test:rls` | Regla 5: aislamiento entre comunidades |
| `npm run test:hooks` | Que los hooks bloquean lo que deben y nada más |

El test de la regla 6 encontró una promesa el mismo día que se escribió: el diálogo de fin de compra
decía que la lista «se mantiene actualizada para el resto del grupo» también sin red. Se cambió el
texto; queda como P-01 en `PREGUNTAS.md`.

## 7. Plugins

Declarados en `.claude/settings.json`, que se commitea. El método los pone en
`settings.local.json`, fuera de git; aquí se mantiene la decisión de la fase 5 de que viajen con el
repo. Solo del marketplace oficial de Anthropic.

| Plugin | Estado | Para qué |
| --- | --- | --- |
| `supabase` | Activo | Buenas prácticas de Postgres y Supabase |
| `expo` | Activo | Despliegue, EAS Update y CI. Su skill `upgrading-expo` **no se usa** (`CLAUDE.md`) |
| `context7` | Activo | Documentación de la versión exacta de cada librería |
| `typescript-lsp` | Activo | Ir a la definición y diagnósticos de tipos |
| `pr-review-toolkit` | Activo | `silent-failure-hunter`, `pr-test-analyzer` y compañía |
| `skill-creator` | Activo desde el 2026-10-31 | Escribir y probar skills nuevas |
| `commit-commands` | Apagado a propósito | Hace commits, lo que prohíbe la regla 4 |
| `superpowers` | Apagado a propósito | Impone su propio flujo de planes y ramas, que choca con los incrementos en serie |

Lo que se miró y no entró:

- **`security-guidance`**: al abrir sesión instala el Agent SDK de Python y en cada Stop lanza una
  revisión del diff con un LLM. Duplica a `bloquear-secretos.mjs` en lo barato y añade latencia y
  coste a cada turno. Para una revisión de seguridad antes de publicar está la skill integrada
  `/security-review`.
- **`claude-md-management`**: útil para mantener `CLAUDE.md` corto, pero su skill se carga sola y
  propone reescribirlo. `CLAUDE.md` se acaba de rehacer a mano con la forma de DietMetric; se
  reconsidera si vuelve a crecer.
- **`code-review`**: Claude Code ya trae la skill `/code-review`.
- **`kotlin-lsp`**: no hay código nativo en el repo (`android/` lo genera `prebuild` y está en
  `.gitignore`).
- **Playwright CLI e `impeccable`**: son para interfaces en el navegador; esta app no tiene web.

## 8. Lo que no se montó del método, y por qué

- **`docs/aprende/` y su diario.** El diario es `docs/phases/`, que ya cuenta el porqué. Mantener
  dos versiones de cada cambio, técnica y para principiantes, no se pidió.
- **`referencia/` y `datos/` con sellos SHA-256.** El proyecto no tiene entradas congeladas que
  definan «correcto». El catálogo se regenera cada semana y vive en Supabase.
- **`docs/plan/hoja-de-ruta.html`.** Opcional en el método. El ROADMAP basta mientras haya un solo
  paquete abierto.
- **Skills `nucleo-puro`, `regla-del-dominio`, `endpoint-api`, `vista-react`,
  `evaluar-contra-el-pasado` y `fuente-de-datos`.** Las dos primeras las cubre `expo-stack`; no hay
  API propia (es Supabase con RLS); la vista la cubren `expo-stack` y `DESIGN.md`; la app no predice
  nada; y la única fuente externa, el catálogo, ya tiene sus dos guías en `docs/guias/`.
- **Agentes `revisor-dominio`, `auditor-evaluacion`, `revisor-fuentes`, `revisor-contrato` y
  `probador-app`.** El dominio son repartos y agrupaciones con tests de valores conocidos; no hay
  evaluación contra el pasado; no hay cliente generado de una API; y la app se prueba en el móvil,
  no en un navegador.
- **Un `revisor-typescript` aparte.** Lo que haría (lint, tipos, tests) ya lo corren `qa-runner` y
  `cerrar-paquete`.
- **Integración continua con los mismos tests.** Se puede proponer como incremento: la Action del
  catálogo ya demuestra que GitHub Actions funciona en este repo.

## 9. Lecciones de este montaje

- El test de la regla 6 cazó una promesa falsa el primer día. Una regla de «lo que la app nunca
  dice» sin test era una sugerencia.
- Los ADR de este repo escriben su estado de tres formas (`- Estado: Aceptado`,
  `- Estado: **Aceptado...**` y `- **Estado:** Aceptado`). La expresión del hook del método solo
  reconocía la primera; `test-hooks.mjs` prueba las tres.
- Jest 29 usa `--testPathPattern` en singular. La forma plural es de Jest 30.
- **En Windows, el patrón de `--testPathPattern` no puede llevar `/`.** Jest lo cambia por el
  separador del sistema y, si el resultado no es una expresión válida, avisa con «Invalid
  testPattern … Running all tests instead» y pasa la suite entera; desde Git Bash, además, MSYS
  convierte `/domain/` en una ruta y Jest no selecciona nada. La primera versión del hook usaba
  `/domain/` y habría dado por buenos unos tests que no ejecutaba. Se usa
  `features.[a-z-]+.domain.`, sin barras, y se probó que selecciona los 34 ficheros y que un test en
  rojo devuelve 2.
- Con `core.autocrlf=true`, un `.gitattributes` con `eol=lf` puede ensuciar el árbol si el índice
  tiene CRLF. Aquí no lo tenía (`git ls-files --eol`, 0 ficheros `i/crlf`).
