# Documentación

Organizada por **para qué sirve cada documento**, no por tema. Si buscas algo:

| Quieres...                                     | Vete a                                                         |
| ---------------------------------------------- | -------------------------------------------------------------- |
| Entender qué es la app y qué se va a construir | [`especificacion-y-roadmap.md`](./especificacion-y-roadmap.md) |
| Saber **por qué** algo está hecho como está    | [`adr/`](./adr/)                                               |
| Ver qué se hizo en cada fase y cómo probarlo   | [`phases/`](./phases/)                                         |
| Hacer una tarea concreta paso a paso           | [`guias/`](./guias/)                                           |
| Las reglas duras que sigue el proyecto         | [`../CLAUDE.md`](../CLAUDE.md)                                 |

El criterio y sus motivos están en
[ADR-0003](./adr/ADR-0003-estructura-del-repositorio.md).

## Decisiones de arquitectura

| ADR                                                              | Decisión                                                 | Estado                            |
| ---------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------- |
| [0001](./adr/ADR-0001-eleccion-de-backend.md)                    | Supabase como backend                                    | Aceptado                          |
| [0002](./adr/ADR-0002-modelo-de-sesion-y-rls.md)                 | Sesión anónima + RLS vía `security definer`              | Aceptado y **verificado** (11/11) |
| [0003](./adr/ADR-0003-estructura-del-repositorio.md)             | Repo de una sola app, sin monorepo                       | Aceptado                          |
| [0004](./adr/ADR-0004-libreria-de-ui.md)                         | NativeWind + Paper solo para overlays                    | Aceptado                          |
| [0005](./adr/ADR-0005-reparto-de-gastos.md)                      | El reparto de gastos exige identidad no suplantable      | Aceptado                          |
| [0006](./adr/ADR-0006-fotos-de-articulos-en-storage.md)          | Fotos en un bucket privado, no en la fila                | Aceptado                          |
| [0007](./adr/ADR-0007-ruta-versionada-de-las-fotos.md)           | Ruta de la foto versionada por artículo                  | Aceptado                          |
| [0008](./adr/ADR-0008-persistencia-local-de-la-cache.md)         | AsyncStorage para la caché, no MMKV                      | Aceptado                          |
| [0009](./adr/ADR-0009-cola-de-mutaciones-offline.md)             | Cola de mutaciones con `setMutationDefaults`             | Aceptado                          |
| [0010](./adr/ADR-0010-id-del-articulo-generado-en-el-cliente.md) | El id del artículo lo pone el cliente                    | Aceptado                          |
| [0011](./adr/ADR-0011-caducidad-y-rotacion-del-join-code.md)     | El `join_code` caduca y se puede rotar                   | Aceptado y **verificado** (24/24) |
| [0012](./adr/ADR-0012-catalogo-de-productos-de-supermercado.md)  | Catálogo de productos para imagen y precio de referencia | Aceptado                          |
| [0013](./adr/ADR-0013-fuente-del-catalogo-mercadona.md)          | El catálogo sale del dataset público de Mercadona        | Aceptado                          |
| [0014](./adr/ADR-0014-origen-de-la-foto-del-articulo.md)         | Origen de la foto del artículo                           | Aceptado                          |
| [0015](./adr/ADR-0015-pin-por-miembro-para-identidad-no-suplantable.md) | PIN de 4 dígitos por miembro para identidad              | Aceptado y **verificado**         |
| [0016](./adr/ADR-0016-clasificacion-de-errores-y-mensaje-al-usuario.md) | Clasificación de errores y mensaje al usuario            | Aceptado                          |
| [0017](./adr/ADR-0017-gestion-de-miembros-y-roles.md)            | Gestión de miembros, roles y participantes invitados     | Aceptado                          |

Formato [Nygard](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions):
Contexto, Decisión, Alternativas consideradas, Consecuencias. Numeración correlativa y sin
reutilizar números.

Un ADR **no se edita para cambiar de opinión**. Registra lo que se sabía en una fecha; si la
decisión cambia, se escribe uno nuevo que diga que supersede al viejo. Lo único que se
actualiza sobre uno existente es su estado (por ejemplo, de "Aceptado" a "Aceptado y
verificado" cuando la prueba que lo respalda pasa).

## Fases

El proyecto va por fases y no se salta a la siguiente sin cerrar la anterior. Cada
`phases/fase-N.md` lleva qué se hizo, las decisiones que no dieron para ADR, cómo probarlo a mano
y la deuda técnica que se asume a sabiendas.

- [Fase 0 · Cimientos](./phases/fase-0.md) — cerrada
- [Fase 1 · MVP CRUD local a la nube](./phases/fase-1.md) — cerrada
- [Fase 2 · Colaboración en tiempo real](./phases/fase-2.md) — cerrada
- [Fase 3 · Imágenes y pulido UX](./phases/fase-3.md) — cerrada
- [Fase 4 · Robustez y offline](./phases/fase-4.md) — cerrada
- [Fase 5 · Endurecimiento antes de publicar](./phases/fase-5.md) — cerrada
- [Fase 6 · Catálogo de productos y reparto de gastos](./phases/fase-6.md) — cerrada (bloque A verificado el 2026-08-24; bloque B verificado en dos móviles el 2026-09-04)
- [Fase 7 · Gestión de miembros (RF-11 y RF-12)](./phases/fase-7.md) — en planificación

Las fases 0 → 4 son el MVP y se probaron en dispositivo con dos móviles; el resultado está en
[la guía de cierre](./guias/prueba-de-cierre-en-dispositivo.md).

## Guías

- [Configurar Supabase](./guias/configurar-supabase.md)
- [Despliegue](./guias/despliegue.md)
- [E2E con Maestro](./guias/e2e-con-maestro.md)
- [Prueba de cierre en dispositivo](./guias/prueba-de-cierre-en-dispositivo.md)
- [Fuentes de datos del catálogo](./guias/fuentes-de-datos-del-catalogo.md) — qué hay publicado
  para sacar imagen y precio de los supermercados españoles, qué permite cada uno y qué números dio
  cada uno el 2026-08-07.
- [Medición de fuentes del catálogo](./guias/medicion-de-fuentes-del-catalogo.md) — cómo funciona el
  script que cuenta cuántos artículos reales encuentra cada fuente, y cómo volver a ejecutarlo. Es
  lo que decidió el [ADR-0013](./adr/ADR-0013-fuente-del-catalogo-mercadona.md).
