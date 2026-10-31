# Roadmap

El plan de trabajo desde la fase 15 en adelante. Lo anterior está contado en `docs/phases/` y no se
repite aquí. Un paquete T-NN es la fase NN: mismo número, mismo diario (`docs/phases/fase-NN.md`).
Dentro de un paquete se trabaja por incrementos, cada uno en su sesión. Razonado en
[ADR-0027](../adr/ADR-0027-metodo-de-trabajo-con-paquetes-y-hooks.md).

El hook `cargar-estado.mjs` imprime el bloque «Estado» al abrir cada sesión y tras cada `/compact`.
Por eso va el primero y se mantiene corto: lo que ya no está abierto sale de aquí y se queda en el
diario de su fase.

## Estado

**T-15 abierto desde el 2026-10-05 (varias listas a la vez, más el plan de arreglos de la
auditoría del 2026-10-11).** Incrementos 1 y 2 hechos: `main` es SDK 57 y versión 1.3.1
(`febae87`), y la runtime 1.2.0 ya no recibe el bundle roto (grupo de EAS `c3353939`). Las
migraciones de los incrementos 3 y 4 (`20261012120000` y `20261012130000`) **están aplicadas en el
proyecto real y en el de ensayo**, sin que nadie lo apuntara: se vio el 2026-10-31 (`fase-15.md`,
apartado 12). Falta comprobarlas, regenerar `db.types.ts`, que sigue con `members.pin_hash`, y
pasar `test:rls`. El 2026-10-31: Jest con 68 suites y 490 tests en verde,
`npm run test:hooks` 89/89, lint con 0 errores y 9 avisos que ya estaban, typecheck limpio. Diario en [`fase-15.md`](../phases/fase-15.md).

**Método de trabajo montado el 2026-10-31**: seis hooks en `.claude/hooks/`, siete skills nuevas,
tres agentes nuevos, los tests de la regla 6 y de las reglas del repositorio, y este ROADMAP.
Detalle en [`METODO-DE-TRABAJO.md`](../tecnica/METODO-DE-TRABAJO.md) y en el apartado 11 de
`fase-15.md`. [ADR-0027](../adr/ADR-0027-metodo-de-trabajo-con-paquetes-y-hooks.md) en
Propuesto hasta que Alejandro lo acepte.

Pendiente del T-15, en este orden (el porqué del orden, en la auditoría, apartado 7):

- Incrementos 3 y 4: verificar en el real las dos migraciones ya aplicadas, regenerar los tipos y
  pasar `test:rls` y `test:realtime`. Necesita el ordenador con `.env`.
- Incremento 6: pantalla del PIN y migración B. Va antes que el 5: hasta la B, una fila sin PIN la
  puede reclamar cualquiera con el código de la lista (ADR-0026).
- Incrementos 5, 7, 8, 9, 10 y 11, en el orden de la tabla de la auditoría.
- El guion de la fase 15 en un Android real (`fase-15.md`, apartado 4). Nadie ha visto el selector de
  listas en un móvil.
- P-01 de [`PREGUNTAS.md`](PREGUNTAS.md): el texto del diálogo de fin de compra que cambió la regla 6.

**Siguiente: T-15, incrementos 3 y 4 · Verificar y cerrar las migraciones ya aplicadas.** El
prompt está en
[`prompts/T-15.md`](prompts/T-15.md).

## Lo que se arrastra de fases anteriores

No bloquea el paquete en curso, pero no se puede perder de vista. Cuando algo se resuelve, se borra
de aquí y se apunta en el diario de la fase que lo cerró.

- **El inglés no se ha visto nunca en un móvil** (fase 5, incremento 3). Si la detección de idioma
  falla, la app cae en español, así que el riesgo está acotado.
- **`scope: { id: 'expenses' }`** solo es correcto mientras un gasto no cuelgue de un artículo creado
  sin conexión (fase 6, B.9).
- **Las fases 7 a 14 no tienen prueba en dispositivo registrada**, aunque sus diarios digan
  «completada».
- **Falta `EXPO_PUBLIC_SENTRY_DSN` en el entorno `preview` de EAS.** Sin ella ningún APK manda
  fallos. Cómo se añade: `docs/guias/despliegue.md`, apartado 2.
- **El enlace del APK 1.3.1 caducó el 2026-10-23.** Para repartirlo hace falta otro build o colgar
  el `.apk` en un sitio estable.
- **TypeScript 6** sigue excluido de `expo doctor` a propósito (fase 15, apartado 6).
- **La atribución de Open Food Facts** es obligatoria si el catálogo llega a traer datos suyos
  (`docs/guias/fuentes-de-datos-del-catalogo.md`).

## Carriles

Agrupan lo que toca las mismas carpetas, para saber qué se mueve al abrir un incremento. No sirven
para trabajar en paralelo.

| Carril     | Carpetas                                          | Incrementos del T-15 |
| ---------- | ------------------------------------------------- | -------------------- |
| Base       | `supabase/migrations/`, `scripts/rls-*`           | 3, 4, 6 (migración B) |
| Identidad  | `src/features/community/`, `src/app/join.tsx`     | 6                    |
| Entrega    | `app.json`, `eas.json`, `src/shared/lib/updates*` | 2, 5, 11             |
| Cliente    | `src/features/*/presentation/`, `src/shared/`     | 7, 8                 |
| Calidad    | `__tests__/`, `jest.config.js`, `docs/`           | 9, 10                |

## Mapa de dependencias

```text
1 ─► 2
1 ─► 3+4 ─► 6 (migración B) ─► 5 ─► 7 ─┐
                                   8 ─┴─► 9 ─► 10 ─► 11
```

## Orden de trabajo

El de la tabla del apartado 7 de [`auditoria-2026-10-11.md`](../auditoria-2026-10-11.md#7-plan-de-arreglos).
Lo que cierra un agujero de seguridad va antes que lo que mejora la entrega, y la cobertura va
detrás de los dos incrementos que cambian código.

## Tabla de paquetes

| Paquete | Nombre                                    | Estado                     | Diario                                     |
| ------- | ----------------------------------------- | -------------------------- | ------------------------------------------ |
| T-0…T-14 | MVP y fases post-MVP                     | Cerradas                   | [`docs/phases/`](../phases/)               |
| T-15    | Varias listas y plan de arreglos          | Abierto, incrementos 3 a 11 | [`fase-15.md`](../phases/fase-15.md)      |
| T-16    | Sin definir                               | Se decide al cerrar el T-15 | —                                         |

## Fichas

### T-15 · Varias listas a la vez y plan de arreglos

**Qué resuelve.** Cambiar de lista sin volver a entrar con código, y los once arreglos que encontró
la auditoría del 2026-10-11: el PIN legible por toda la lista, las versiones que no llegan a los
móviles y lo que cuelga de ahí.
**Entra:** el selector de listas ya hecho (incrementos de la fase), las dos migraciones escritas y el
`.env` del ordenador que aplica.
**Sale:** las dos migraciones aplicadas, la migración B, la pantalla del PIN, updates por aire con
aviso de versión, los arreglos de Realtime, mutaciones, i18n y accesibilidad, la cobertura y la
build de Play Store en prueba interna.
**Manda:** [ADR-0025](../adr/ADR-0025-varias-listas-por-usuario-y-lista-activa.md),
[ADR-0026](../adr/ADR-0026-pin-fuera-de-members-y-recuperacion-de-identidad.md) y el apartado 7 de la
auditoría.
**Terminado cuando:** `npm run test:rls` da 102/102 contra el proyecto real; `npm test` en verde con
la cobertura de `jest.config.js`; el guion del apartado 4 de `fase-15.md` recorrido en un Android
real con la versión que diga el pie de la lista; los once incrementos con su estado en
`fase-15.md`.
**Cuidado con:** entre la migración A y la B la suplantación sigue abierta. `join_community` solo
puede devolver sus seis estados actuales, porque los APK instalados tratan cualquier otro como error.
Nada se publica contra la runtime 1.2.0.

## Cómo se cierra un paquete

Cinco cosas, y las cinco. Las recorre la skill `cerrar-paquete`.

1. Tests en verde: `npm test`, `npm run test:coverage`, `npm run test:hooks`, y `npm run test:rls` y
   `npm run test:realtime` si el paquete tocó la base o Realtime. Sin `.skip` y sin bajar umbrales.
2. `npm run lint` y `npm run typecheck` limpios, sin avisos silenciados nuevos.
3. La documentación actualizada en el mismo cambio, con la tabla de la skill `documentar-cambio`.
4. `db.types.ts` regenerado si cambió el esquema, y `npx expo export --platform android` sin errores.
5. El árbol listo y avisado: `git status`, qué entra, qué no y el mensaje de commit.

Y además, el guion en el Android real (regla de la plataforma en `CLAUDE.md`) y la entrada del
diario de la fase.

## Qué bloquea el proyecto ahora mismo

Que `db.types.ts` no cuadra con el esquema real. Las dos migraciones están aplicadas, pero los tipos
siguen declarando `members.pin_hash` y no conocen `member_secrets` ni las tres RPC del PIN, así que
el incremento 6 no puede escribir su adaptador hasta regenerarlos. Y hasta la migración B, una fila
sin PIN la sigue pudiendo reclamar cualquiera con el código de la lista.
