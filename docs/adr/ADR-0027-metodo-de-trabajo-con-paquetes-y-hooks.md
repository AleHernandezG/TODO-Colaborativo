# ADR-0027: Método de trabajo con paquetes, hooks y revisores

- Estado: Propuesto
- Fecha: 2026-10-31
- Relacionado: ADR-0003 (estructura del repositorio)

## Contexto

Hasta hoy las reglas del repo vivían en un `CLAUDE.md` de 552 líneas que mezclaba tres cosas: las
reglas que no cambian, el estado de las fases 5, 6 y 15 y la historia de cómo se llegó a cada
regla. Solo una regla se comprobaba fuera del modelo, la de no commitear, con un hook que miraba
`commit` y `push`. Las demás dependían de que la sesión se acordara. Pasó varias veces que no se
acordara:

- `meal-planner`, `notifications` y `recipes` estuvieron fuera del lint desde su creación hasta el
  2026-10-11, y el lint salía en verde.
- Se publicaron dos updates por aire contra la runtime 1.2.0 sin subir la `version`, y ese APK
  revienta al ejecutarlos.
- El plan de arreglos del 2026-10-11 vivía en una auditoría de 912 líneas y un traspaso de 304, y
  cada sesión tenía que encontrar en ellos por dónde iba.

Alejandro trabaja así en otro repositorio (DietMetric), con un método escrito en
`METODO-PARA-PROYECTO-NUEVO.md` y `PIEZAS-PARA-PROYECTO-NUEVO.md`, y pidió aplicarlo aquí.

## Alternativas

**Migrar `docs/` a la estructura del método** (`docs/plan/`, `docs/tecnica/adr/NNNN-...`,
`docs/aprende/diario/`). Es lo que trae el método tal cual. Se descartó porque obliga a mover 26
ADR, renombrarlos y reescribir cientos de enlaces en los diarios, las skills y los agentes, a cambio
de nada que la estructura actual no haga ya. Lo decidió Alejandro el 2026-10-31.

**Paquetes T-NN independientes de las fases**, empezando por T-00. Se descartó porque habría dos
numeraciones para lo mismo y el T-00 chocaría con la fase 0. Un paquete es una fase y lleva su
número.

**Un paquete por incremento.** Paquetes más pequeños, pero muchos más ficheros de prompt, y los
prompts de los incrementos del T-15 ya existían en la auditoría.

**Seguir como estaba.** Sin coste de montaje, pero cada regla nueva seguiría siendo una frase más en
`CLAUDE.md` que nada comprueba.

## Decisión

- `docs/` se queda como está y se le añaden `docs/plan/` (ROADMAP con bloque «Estado», PREGUNTAS y
  prompts) y `docs/tecnica/` (METODO-DE-TRABAJO, STACK, GLOSARIO y ESTRUCTURA). Los ADR siguen en
  `docs/adr/ADR-NNNN-...` y los diarios en `docs/phases/`. Esto amplía ADR-0003 sin sustituirlo.
- Un paquete T-NN es la fase NN, con su diario en `docs/phases/fase-NN.md`. Dentro se trabaja por
  incrementos, un incremento por sesión, cada uno con su prompt.
- El estado sale de `CLAUDE.md` y vive en el bloque «Estado» del ROADMAP, que un hook imprime al
  abrir cada sesión.
- Las reglas que se pueden comprobar fuera del modelo se comprueban con hooks y tests:

  | Hook o test | Qué comprueba |
  | --- | --- |
  | `bloquear-escrituras-git` | Escrituras en git y GitHub, `eas build/update/submit` y `supabase db push` |
  | `proteger-intocables` | `.env`, `db.types.ts`, las migraciones que ya están en git y los ADR aceptados |
  | `bloquear-secretos` | Que no se escriba una clave en ningún fichero |
  | `formatear` | Pasa Prettier sobre el fichero escrito |
  | `comprobar-nucleo` | Pasa los tests de `domain/` al terminar el turno si algún `domain/` cambió |
  | `forbidden-claims.test.ts` | La regla 6 |
  | `repository-rules.test.ts` | Que el lint y la estructura cubren todas las features |

- `CLAUDE.md` adopta la forma del de DietMetric: qué leer, seis reglas obligatorias numeradas, las
  reglas del proyecto en párrafos cortos, cómo se trabaja con sus tablas, estilo, vocabulario y
  órdenes.
- El detalle de cada pieza, lo que se miró y no entró, en `docs/tecnica/METODO-DE-TRABAJO.md`.

## Consecuencias

Buenas: las prohibiciones con consecuencias fuera del repo (un push, un update a la runtime
equivocada, un `db push`) ya no dependen de que la sesión lea `CLAUDE.md`. Cada sesión arranca
sabiendo por dónde va el proyecto sin abrir la auditoría. Una feature nueva fuera del lint rompe un
test.

Malas:

- Hay dos sitios con estructura de documentación distinta de la del método, y quien llegue de
  DietMetric buscará `docs/tecnica/adr/` y `docs/aprende/diario/` y no los encontrará.
  `docs/README.md` lo explica.
- `comprobar-nucleo` añade el tiempo de los tests de `domain/` al final de cada turno que los toque
  (unos 30 s).
- `bloquear-secretos` trabaja con patrones conocidos: puede dejar pasar un secreto con otra forma y
  bloquear una cadena larga inofensiva que se llame `token`.
- `.gitattributes` fija LF para todo el repo. Hoy no cambia nada, porque el índice ya estaba en LF,
  pero un fichero CRLF nuevo aparecerá normalizado.
- `CLAUDE.md` pierde la narración de las fases 5 y 6. Se queda en sus diarios, y lo que seguía
  abierto pasa al ROADMAP.

## Fuentes

- `METODO-PARA-PROYECTO-NUEVO.md` y `PIEZAS-PARA-PROYECTO-NUEVO.md`, versión de octubre de 2026.
- El repositorio DietMetric, leído el 2026-10-31: `CLAUDE.md`, `.claude/`, `docs/plan/` y
  `docs/tecnica/METODO-DE-TRABAJO.md`.
- Hooks de Claude Code: https://docs.claude.com/en/docs/claude-code/hooks (2026-10-31).
