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
(`febae87`). **Incrementos 3 y 4 cerrados el 2026-11-02, con su paso en el Android**: las dos
migraciones están aplicadas con `db push` y comprobadas en el real, `db.types.ts` regenerado,
`test:rls` 102/102 y `test:realtime` 18/18 contra el real, Jest con 68 suites y 490 tests,
`test:hooks` 103/103, lint con 0 errores y 9 avisos que ya estaban, typecheck limpio. Diario en
[`fase-15.md`](../phases/fase-15.md), apartados 12 y 13.

**El POCO F5 tiene la 1.3.1 desde el 2026-11-02** (build `08f58498`, pie `v1.3.1 · base`), y la
sesión lo prueba sola por `adb` y Maestro (`docs/guias/e2e-con-maestro.md`). El guion del PIN pasó
entero, salvo la aserción «Estás dentro como Ana», que tapa la cabecera: crear, unirse, volver con
el PIN sin crear un duplicado, PIN equivocado, atrás y sin red, que cumple la regla 6. HyperOS no
deja usar `launchApp` y el flujo va en tramos. Salieron cinco hallazgos (`fase-15.md`, apartado
13), y dos son graves:

- **Gastos tumba la app en la 1.3.1**: canal `members:<id>` repetido en `subscribeMembers`.
- **La cabecera de la lista aplasta el título a 19 px** con la letra al 115 %, y con él el selector
  de listas. Alejandro pidió rediseñar todas las pantallas y lo decidió en
  [P-04](PREGUNTAS.md#p-04--alcance-y-orden-del-rediseño): paquete T-16, con su ficha abajo.

Además, al pasar de la 1.2.0 a la 1.3.1 el POCO perdió su lista. Hay que averiguarlo antes del
incremento 5.

**Método de trabajo montado el 2026-10-31**: seis hooks en `.claude/hooks/`, siete skills nuevas,
tres agentes nuevos, los tests de la regla 6 y de las reglas del repositorio, y este ROADMAP.
Detalle en [`METODO-DE-TRABAJO.md`](../tecnica/METODO-DE-TRABAJO.md) y en el apartado 11 de
`fase-15.md`. [ADR-0027](../adr/ADR-0027-metodo-de-trabajo-con-paquetes-y-hooks.md) en
Propuesto hasta que Alejandro lo acepte.

Orden de las próximas sesiones (P-04, respuesta A con A1), una por prompt de `prompts/`:

1. El arreglo de Gastos (canal de miembros repetido) y averiguar la lista perdida:
   [`T-15-gastos.md`](prompts/T-15-gastos.md). Un fallo que tumba la app en la versión que se va
   a repartir va antes que todo lo demás.
2. T-16.1, herramientas para medir y foto de partida: [`T-16-1-herramientas.md`](prompts/T-16-1-herramientas.md).
3. T-16.2, el diseño sin código: [`T-16-2-diseno.md`](prompts/T-16-2-diseno.md).
4. Incremento 6 del T-15, la pantalla del PIN con el diseño nuevo y la migración B:
   [`T-15.md`](prompts/T-15.md). Hasta la B, una fila sin PIN la puede reclamar cualquiera con el
   código de la lista (ADR-0026). Hay 12 listas cuyo único admin no tiene PIN y 20 miembros activos
   sin PIN.
5. T-16.3 a T-16.8, con sus prompts en `prompts/T-16-*.md`.
6. Incrementos 5, 7, 8, 9, 10 y 11 del T-15, en el orden de la tabla de la auditoría, sin lo que
   absorbieron el arreglo de Gastos y el T-16 (ficha del T-16, «Absorbe»).
- El guion de la fase 15 en un Android real (`fase-15.md`, apartado 4). El selector de listas ya se
  vio en el POCO (se abre y atrás lo cierra); falta cambiar de lista y el resto del guion.
- P-01 de [`PREGUNTAS.md`](PREGUNTAS.md): el texto del diálogo de fin de compra que cambió la regla 6.

**Siguiente: el arreglo de Gastos del T-15**, con su prompt en
[`prompts/T-15-gastos.md`](prompts/T-15-gastos.md).

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
- **Los APK de EAS caducan.** El 1.3.0 y el 1.3.1 (`5f8bd1c3`) daban `NoSuchKey` el 2026-11-02.
  Cada APK se descarga al terminar su build y se guarda en `~/tools/apk/`; para repartirlo, un sitio
  estable (lo decide el incremento 5).
- **`generate_join_code()` la puede ejecutar `authenticated`** (fase 15, apartado 12, c3c). No
  filtra datos. Su `revoke` va en la migración B del incremento 6.
- **`camino-feliz.yaml` y `cola-offline.yaml` están desfasados desde la fase 15**: no rellenan el
  PIN y el primero pulsa «Salir de esta lista», que ya no existe (ADR-0025). Hasta arreglarlos,
  `npm run test:e2e` falla en ellos.
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
| T-16    | Rediseño de las pantallas                 | Aprobado (P-04), sin empezar | `fase-16.md`, lo crea el incremento 1    |

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

### T-16 · Rediseño de las pantallas

**Qué resuelve.** Que la app se pueda usar en un Android real con la letra del sistema grande: el
2026-11-02, en el POCO con la letra al 115 %, la cabecera de la lista dejó el título en 19 px, el
código de invitación quedó a dos deslizamientos y nada de eso lo vio ningún test. Navegación nueva,
cabecera nueva y las 15 pantallas de `src/app/` rehechas según un `DESIGN.md` reescrito.
**Entra:** la 1.3.1 en el POCO con el arreglo de Gastos por aire, el `DESIGN.md` de hoy, los tokens
de `src/theme/tokens.js` y la prueba por `adb` y Maestro.
**Sale:** un script que mide una pantalla desde su árbol de `uiautomator` y un test que caza los
estilos fuera de los tokens (incremento 1); `DESIGN.md` nuevo, ADR-0028 de navegación y bocetos
(2); navegación y cabecera (3); lista y modo supermercado (4); recetas y menú (5); gastos y
miembros (6); bienvenida, crear y unirse (7); cierre con TalkBack, letra al máximo, modo oscuro y
los tres flujos de Maestro al día (8).
**Absorbe del T-15:** del incremento 7 de la auditoría, los puntos 1 a 3 y los respaldos del canal
de miembros del 7 (los hace el arreglo de Gastos), los puntos 4 y 5 (T-16.3) y el 6 (T-16.4); del
incremento 8, el bloque 3 de accesibilidad y diseño (T-16.4 a T-16.6) y, en miembros, los mensajes
concatenados del bloque 2 (T-16.6). El fallo 23, blanco sobre el primario en oscuro, va al T-16.3
por `src/shared/ui`; el aviso de unos 12 s sin red (hallazgo 5 de `fase-15.md`) se diseña en el
T-16.2 y se pinta en el T-16.7, sin tocar el timeout. Los bloques 1 y 2 del incremento 8 y el resto
del 7 se quedan en el T-15.
**Manda:** `DESIGN.md`, ADR-0028 cuando exista, [ADR-0004](../adr/ADR-0004-libreria-de-ui.md) y
[ADR-0025](../adr/ADR-0025-varias-listas-por-usuario-y-lista-activa.md).
**Terminado cuando:** las cinco condiciones de «Cómo se cierra un paquete»; la lista de excepciones
del test de diseño vacía; el script de inspección sin marcas en las 15 pantallas con la letra al máximo,
o cada una explicada; `pin-unirse`, `camino-feliz` y `cola-offline` pasan en el POCO.
**Cuidado con:** si la navegación pide código nativo, la versión pasa a 1.4.0 con build nuevo y nada
del T-16 llega a la 1.3.1 hasta entonces; lo decide Alejandro en el incremento 2. `NativeTabs` es API
inestable en el SDK 57 y cambia de ruta en el 58. P-02 (44 pt o 48 dp) fija las medidas: mejor
respondida antes del incremento 2.

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

Que la suplantación sigue abierta hasta la migración B: una fila sin PIN la puede reclamar
cualquiera con el código de la lista, y los 120 PIN que fueron legibles siguen valiendo. La B no se
puede aplicar sin más, porque hay 12 listas cuyo único admin no tiene PIN y se quedarían sin forma
de recuperarlo. Antes hace falta la pantalla del PIN del incremento 6. El POCO ya tiene la 1.3.1 para
probarla.
