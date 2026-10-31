---
name: cerrar-paquete
description: Cierra un paquete T-xx del ROADMAP con las cinco condiciones, los revisores que tocan, el bloque de estado y la propuesta de commit. Úsala cuando el «Terminado cuando» de un paquete parece cumplido, al cerrar una fase y antes de decir que un paquete está terminado. Para un incremento suelto basta con qa-runner.
---

# Cerrar un paquete

Un paquete que cumple cuatro de las cinco condiciones no está cerrado. Esta skill es «Cómo se cierra
un paquete» de `docs/plan/ROADMAP.md` convertida en pasos, más los revisores de `.claude/agents/` en
el orden en que rinden. Cada incremento ya pasó por `qa-runner`; esto es lo que se añade al final.

## 1. Lo que se comprueba solo

Ejecuta y apunta el número exacto de cada uno. Nada de «unos 480»:

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:hooks
npx expo export --platform android
```

Si el paquete tocó la base o Realtime, también `npm run test:rls` (102/102, o 101/102 sin
`SUPABASE_SECRET_KEY`) y `npm run test:realtime` (18/18). Necesitan `.env`: si no está en esta
máquina, dilo, no lo des por pasado.

Un test en rojo, un `.skip` nuevo, un `eslint-disable` sin motivo escrito o un umbral de cobertura
bajado, y aquí se para.

Si cambió el esquema, `db.types.ts` regenerado desde Git Bash, y `git diff` sobre él enseña solo lo
esperado. Si cambió `package.json`, `npm ci --dry-run` pasa.

## 2. Los revisores

Uno detrás de otro, nunca a la vez: cada informe puede cambiar lo que mira el siguiente.

| Si el paquete tocó | Revisor |
| --- | --- |
| `src/` | `architecture-guard` |
| `supabase/migrations/`, RLS, RPC o Realtime | `migration-reviewer` |
| manejo de errores, `catch`, fallbacks | `pr-review-toolkit:silent-failure-hunter` |
| tests nuevos o cobertura | `pr-review-toolkit:pr-test-analyzer` |
| cierre de fase | `docs-drift-auditor` |
| siempre, el último | `revisor-documentacion` |

Cada hallazgo se arregla o se apunta como pendiente en el bloque «Estado» del ROADMAP, con
«Después: T-xx» si lo recoge otro paquete o «Se queda:» con el motivo si no se va a hacer. Un
hallazgo que no compartes se discute con Alejandro, no se ignora en silencio.

## 3. El Android real

Un paquete no está terminado porque compile. El guion de `fase-N.md` se recorre en el móvil con el
APK del perfil `preview` o con el update publicado, comprobando antes la versión en el pie de la
lista. Si lo que cambió es sincronización, con dos móviles. Si no se ha recorrido, el paquete no se
cierra: se dice y se apunta en «Estado».

## 4. La documentación

Con lo que diga `revisor-documentacion`, y la skill `documentar-cambio` para el formato. Siempre:

- el bloque «Estado» de `docs/plan/ROADMAP.md`: «T-xx terminado el AAAA-MM-DD», los recuentos
  exactos, lo que queda fuera y el enlace al diario; lo que ya no está abierto sale del bloque
- «Siguiente» en el ROADMAP, que sale del orden de trabajo y no del número
- el cierre de `docs/phases/fase-N.md`, con lo que no se hizo y por qué
- `CLAUDE.md` no lleva estado: si algo de lo que dice ha dejado de ser verdad (una versión, un
  recuento de `test:rls`), se corrige allí también
- el prompt del siguiente paquete con la skill `prompt-de-paquete`, si no existe

## 5. La entrega

No ejecutas `git commit`, `git add` ni nada que escriba en el historial (regla 4; el hook lo bloquea
igual). Le das a Alejandro:

- la salida de `git status --short`
- qué ficheros entran en el commit y cuáles se quedan fuera, con el motivo de cada uno
- si en el árbol hay trabajo de otro paquete o suyo pendiente de commit, lo dices y separas lo tuyo
- el mensaje de commit en inglés, imperativo y corto, con el prefijo que usa el repo:
  `feat(community): add list switcher`, `docs(fase-15): ...`
- las órdenes exactas para copiar, con `git add` fichero por fichero si no entra todo
- si hace falta `eas update`, `eas build` o `supabase db push`, la orden preparada, sin lanzarla
