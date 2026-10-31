---
name: documentar-cambio
description: Actualiza la documentación después de un cambio. Úsala al terminar cualquier tarea que toque el dominio, el esquema o la RLS, una pantalla, un texto de i18n, una dependencia, la configuración de EAS o .claude/, y al cerrar un incremento o un paquete del ROADMAP.
---

# Documentar un cambio

Regla 2 de `CLAUDE.md`: ningún cambio se cierra sin su documentación, y la documentación va en el
mismo commit que el código. El chat se pierde; el repo no.

## Qué actualizar según lo que hayas tocado

| Has cambiado | Actualiza |
| --- | --- |
| Una regla del dominio en `src/features/*/domain/` | `docs/phases/fase-N.md` y, si cambia una decisión, un ADR nuevo |
| Una tabla, columna, RPC o política RLS | ADR nuevo si cambia el modelo o la seguridad; la skill `supabase-data` si es detalle de una regla que ya existe; `scripts/rls-isolation-test.mjs` con su comprobación |
| Una pantalla o el aspecto de un componente | `DESIGN.md` si aparece un color, tamaño o radio nuevo; el guion de prueba en `fase-N.md` |
| Un texto de `es.json` | `en.json` a la vez, y los flujos de `.maestro/` que lo citen literal |
| Una dependencia o su versión | `docs/tecnica/STACK.md` con la fecha, `package-lock.json` en el mismo cambio |
| `app.json`, `eas.json` o el canal de updates | `docs/guias/despliegue.md` |
| Una carpeta nueva o dónde vive una responsabilidad | `docs/tecnica/ESTRUCTURA.md` y, si es una feature, el array `features` de `eslint.config.js` |
| Un término del dominio | `CLAUDE.md` y `docs/tecnica/GLOSARIO.md`, los dos |
| Una skill, agente, hook o plugin | `docs/tecnica/METODO-DE-TRABAJO.md` y la tabla de `CLAUDE.md` si aplica |
| Una decisión con alternativas descartadas | un ADR nuevo con la skill `adr` |
| Un procedimiento que habrá que repetir | `docs/guias/<tarea>.md` |
| Una pregunta que decide Alejandro | `docs/plan/PREGUNTAS.md`, con la respuesta debajo cuando llegue |
| Un incremento terminado | su apartado en `docs/phases/fase-N.md` |
| Un paquete completo | el bloque «Estado» de `docs/plan/ROADMAP.md` y el cierre del diario de la fase |

Si el fichero todavía no existe, se crea en ese momento y se añade su fila a `docs/README.md`.

## Qué lleva cada entrada

Tres preguntas, siempre: **qué** se cambió, **por qué** (qué alternativa se descartó y a costa de
qué) y **qué implica** para quien toque eso después. Lo que no encaje en ningún sitio va en
`fase-N.md`, apartado «Decisiones sobre la marcha».

## El diario de la fase

`docs/phases/fase-N.md` hace de diario del paquete T-N. Al cerrar el paquete, además de lo que ya
lleva (qué se hizo, verificación, cómo probarlo a mano, decisiones, deuda), cuenta:

- qué había antes
- qué decisión costó tomar y por qué acabó siendo esa
- qué se rompió por el camino
- qué queda pendiente, con el paquete que lo recoge

Escrito como se le contaría a alguien, no como un parte de trabajo.

## Estilo

Castellano directo, con personalidad. Nada de «cabe destacar» ni «es importante mencionar». Sin
negritas mecánicas, sin rayas largas en cada frase, sin listas de exactamente tres puntos.
