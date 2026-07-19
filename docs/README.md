# Documentación

Organizada por **para qué sirve cada documento**, no por tema. Si buscas algo:

| Quieres... | Vete a |
|---|---|
| Entender qué es la app y qué se va a construir | [`especificacion-y-roadmap.md`](./especificacion-y-roadmap.md) |
| Saber **por qué** algo está hecho como está | [`adr/`](./adr/) |
| Ver qué se hizo en cada fase y cómo probarlo | [`phases/`](./phases/) |
| Hacer una tarea concreta paso a paso | [`guias/`](./guias/) |
| Las reglas duras que sigue el proyecto | [`../CLAUDE.md`](../CLAUDE.md) |

El criterio y sus motivos están en
[ADR-0003](./adr/ADR-0003-estructura-del-repositorio.md).

## Decisiones de arquitectura

| ADR | Decisión | Estado |
|---|---|---|
| [0001](./adr/ADR-0001-eleccion-de-backend.md) | Supabase como backend | Aceptado |
| [0002](./adr/ADR-0002-modelo-de-sesion-y-rls.md) | Sesión anónima + RLS vía `security definer` | Aceptado y **verificado** (11/11) |
| [0003](./adr/ADR-0003-estructura-del-repositorio.md) | Repo de una sola app, sin monorepo | Aceptado |
| [0004](./adr/ADR-0004-libreria-de-ui.md) | NativeWind + Paper solo para overlays | Aceptado |

Formato [Nygard](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions):
Contexto, Decisión, Alternativas consideradas, Consecuencias. Numeración correlativa y sin
reutilizar números.

Un ADR **no se edita para cambiar de opinión**. Registra lo que se sabía en una fecha; si la
decisión cambia, se escribe uno nuevo que diga que supersede al viejo. Lo único que se
actualiza sobre uno existente es su estado (por ejemplo, de "Aceptado" a "Aceptado y
verificado" cuando la prueba que lo respalda pasa).

## Fases

El proyecto va por fases, de la 0 a la 4, y no se salta a la siguiente sin cerrar la anterior.
Cada `phases/fase-N.md` lleva qué se hizo, las decisiones que no dieron para ADR, cómo probarlo
a mano y la deuda técnica que se asume a sabiendas.

- [Fase 0 · Cimientos](./phases/fase-0.md) — en curso
