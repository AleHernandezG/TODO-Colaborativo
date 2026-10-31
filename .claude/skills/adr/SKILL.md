---
name: adr
description: Escribe un registro de decisión de arquitectura en docs/adr/. Úsala al elegir entre alternativas técnicas, al cambiar el modelo de datos, una política RLS o la seguridad, al elegir una librería o un servicio, al decidir de dónde sale un dato, o al descartar una opción por un motivo que dentro de un año no será obvio.
---

# ADR: registro de decisión

Un ADR captura por qué se decidió algo cuando todavía se recuerda. Sin él, dentro de unos meses
alguien deshace la decisión «porque es más fácil» sin saber qué problema resolvía. Aquí ya pasó: el
ADR-0008 descartó MMKV por Expo Go, y sigue mandando aunque ese motivo ya no exista, porque nadie ha
escrito el que lo sustituye.

## Cuándo escribir uno

- Al elegir entre alternativas reales: librería, servicio, forma de los datos.
- Al cambiar el esquema, una política RLS o el modelo de sesión. `CLAUDE.md` lo exige.
- Cuando Alejandro autoriza algo de la regla 1. El ADR lleva los números que lo justificaron.
- Al descartar lo obvio por un motivo que no lo es.

No hace falta ADR para «he usado un `map` en vez de un bucle». El detalle de una regla que ya existe
va en la skill del área; lo de un incremento, en `docs/phases/fase-N.md`.

## Formato

`docs/adr/ADR-NNNN-titulo-en-kebab.md`, numerado sin huecos. El siguiente número libre es el
siguiente al de la última fila de la tabla «Decisiones de arquitectura» de `docs/README.md`.

```markdown
# ADR-NNNN: Título en una línea

- Estado: Propuesto
- Fecha: AAAA-MM-DD
- Relacionado: ADR-XXXX (si lo hay)

## Contexto

Qué obliga a decidir. Los hechos, con números si los hay.

## Alternativas

Las que se miraron de verdad, cada una con su motivo de descarte.

## Decisión

Qué se hace, en presente y en afirmativo.

## Consecuencias

Lo bueno y lo malo. Lo malo nunca está vacío.

## Fuentes

Enlaces con fecha de consulta.
```

## Reglas

- **Un ADR aceptado no se edita.** Si la decisión cambia, se escribe otro que lo sustituya y en el
  viejo solo cambia la línea `Estado:` a `Sustituido por [ADR-NNNN](...)`. El hook
  `proteger-intocables.mjs` bloquea cualquier otra edición.
- La sesión lo escribe como `Propuesto`. Pasa a `Aceptado` cuando Alejandro lo dice, no antes.
- Las consecuencias negativas no pueden estar vacías. Si no encuentras qué cuesta, no has entendido
  la alternativa que descartaste.
- Enlaza las fuentes. La regla 2 pide buscar antes de elegir, y el ADR es donde se demuestra.
- Si el cambio es de esquema, el diseño pasa por `migration-reviewer` antes de escribir el `.sql`.
- Al terminar, añade la fila a la tabla de `docs/README.md`.

## Ya decididos

Mira la tabla de `docs/README.md` antes de abrir uno. Si la decisión ya está aceptada, no se
vuelve a preguntar.
