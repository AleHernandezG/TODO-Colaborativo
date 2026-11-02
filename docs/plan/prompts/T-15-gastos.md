# Prompt de arranque · T-15 · Gastos sin cierres y la lista que se perdió al actualizar

Va el primero, antes del T-16 y del incremento 6 (P-04, respuesta A con A1). Arregla el cierre de
la app al abrir Gastos en la 1.3.1 y averigua, sin cambiar nada, por qué el POCO perdió su lista al
pasar de la 1.2.0 a la 1.3.1.

Lo que se encuentra, el 2026-11-02:

- Gastos tumba la app en la 1.3.1 (POCO, 20:24 y 20:26). El error es `cannot add
  postgres_changes callbacks for realtime:members:<id> after subscribe()`. Lo había anunciado la
  auditoría (fallo 10): `useCommunityMembers` abre el canal `members:<id>` dentro del hook de
  lectura, y `ExpensesScreen` lo llama dos veces, una directa y otra a través de
  `useExpenseSummary`. El hook se usa en seis sitios.
- Hay cinco canales más con la misma forma (`items`, `expenses`, `presence`, `recipes` y
  `meal_plan_slots`). Ninguno ha tumbado nada todavía, pero dos pantallas apiladas los pueden abrir
  dos veces.
- La lista del POCO desapareció al instalar la 1.3.1 encima de la 1.2.0. Los stores persistidos
  `active-community` y `session` no llevan `version` ni `migrate`, y ADR-0025 cambió lo que guarda
  el primero. Es una sospecha, no un hallazgo.

Este incremento absorbe los puntos 1, 2, 3 y la parte de miembros del 7 (los respaldos del canal)
del incremento 7 de la auditoría. Lo demás del 7 se reparte entre el T-16 (navegación) y lo que queda del propio 7.

Recuentos de partida: Jest con 68 suites y 490 tests, `test:hooks` 103/103, `test:rls` 102/102 y
`test:realtime` 18/18 contra el real, lint con 0 errores y 9 avisos que ya estaban, typecheck limpio.
El POCO tiene la 1.3.1 `base` (build `08f58498`). No queda ninguna pregunta abierta. Siguiente ADR libre: 0028; siguiente pregunta libre: P-05.

Se pega tal cual en la sesión.

---

```
Vas a hacer el arreglo de Gastos del paquete T-15 de docs/plan/ROADMAP.md: que abrir Gastos no
tumbe la app en la 1.3.1, sacando la suscripción a Realtime de los hooks de lectura. Además
averiguas, sin cambiar código, por qué el POCO perdió su lista al pasar de la 1.2.0 a la 1.3.1.
data/ abre el canal como hasta ahora; presentation/ decide cuántas veces se abre por pantalla.

No hagas commit, push, eas update, eas build ni supabase db push: los hooks los bloquean y los
lanzo yo. Tampoco adb uninstall ni maestro cloud. Si al empezar git status trae algo, dímelo antes
de tocar nada: lo que haya es mío y no se ordena ni se descarta. Hay un .txt en docs/ que no se
abre, no se lee y no entra en ningún commit.

El ritmo: me enseñas el plan y las decisiones de golpe, cada una con tu recomendación y la
alternativa que descartas. Si contesto «adelante», van como las propones. A partir de ahí solo te
paras en los casos de «Donde sí te paras».

Antes de nada, lee en este orden:
  1. docs/phases/fase-15.md, apartado 13, «Salieron cinco hallazgos» (el 1 y el 3)
  2. docs/auditoria-2026-10-11.md: el fallo 10 del apartado 6 y el «Incremento 7» del apartado 7.
     Lo que diga este prompt manda donde no coincidan
  3. La skill expo-stack: Realtime, stores persistidos e hidratación
  4. src/features/community/presentation/hooks/use-community-members.ts,
     src/features/expenses/presentation/hooks/use-expense-summary.ts y ExpensesScreen.tsx
  5. docs/adr/ADR-0025-varias-listas-por-usuario-y-lista-activa.md, solo lo que cuenta del store
     de la lista activa

No explores fuera de esta lista. Para un símbolo, el LSP de TypeScript antes que leer ficheros
enteros (los usos de useCommunityMembers y de cada subscribe*); context7 para el comportamiento de
supabase.channel() en la versión de @supabase/supabase-js instalada.

Dónde escribes:
  - src/features/community/presentation/hooks/: el hook de suscripción y el de lectura
  - las pantallas de expenses y community que hoy llaman a useCommunityMembers, si cambia dónde se
    monta la suscripción
  - los __tests__ junto a cada fichero que cambies
  - docs/phases/fase-15.md, apartado nuevo; docs/plan/ROADMAP.md; la skill expo-stack, sección de
    Realtime, con la regla nueva

Qué no tocas:
  - data/ y el puerto CommunityRepository, salvo que el plan lo justifique: subscribeMembers ya
    filtra por community_id y el fallo está en quién lo llama
  - los stores persistidos: la parte de la lista perdida es solo investigar. Un version/migrate
    mal puesto borra la sesión de todos los móviles
  - app.json, el SDK y las dependencias: esto es solo JS y llega por aire a la 1.3.1
  - la navegación (useGoToList, notificaciones, atrás en el modo supermercado): va al T-16

Decisiones que tienes que tomar:
  1. Cómo se abre el canal una sola vez. Recomiendo un hook useMembersRealtime(communityId) que
     monta la pantalla, una vez, y useCommunityMembers como lectura pura. Descartados: un topic
     distinto por llamada (members:<id>:<n>), que abre N canales para lo mismo, y un registro con
     recuento de referencias en data/, que arregla los seis canales a la vez pero mete estado
     global donde hoy no hay. Si los otros canales tienen el mismo riesgo, propón cuál de las dos
     vías sirve para los seis y no lo apliques a los otros cinco sin mi OK
  2. Dónde se monta useMembersRealtime cuando hay dos pantallas apiladas que lo necesitan (Gastos
     con Miembros encima). Tu propuesta, con lo que pasa al cerrar la de arriba
  3. La lista perdida: qué guardaba la 1.2.0 en AsyncStorage, qué espera leer la 1.3.1 y qué hace
     cuando no cuadra. Me das la causa con su prueba (un test que lo reproduce, o el contenido de
     las claves en el POCO por adb run-as si se puede), y la propuesta de arreglo con su coste.
     El arreglo no se escribe aquí: va al incremento 5, que es el de los updates
  4. Los respaldos del canal de miembros (punto 7 del incremento 7 de la auditoría): refetch tras
     SUBSCRIBED, onStatus y useAppForeground, en el hook nuevo. Los de los otros cinco canales
     se quedan en lo que queda del incremento 7

Casos límite y errores (ADR-0016):
  - Sin red: abrir el canal no lleva assertOnline() (reconecta solo); la lectura de miembros sí.
    Gastos sin red enseña lo que haya en caché y el aviso de sin conexión, sin cerrarse
  - Sin servidor: el canal se queda en CHANNEL_ERROR o TIMED_OUT; que no lance nada a la pantalla
  - Desmontar y volver a montar Gastos rápido: el canal se cierra antes de que se abra el nuevo, o
    el nuevo no se abre. Que haya un test
  - Cambiar de lista con Gastos abierto: se cierra members:<vieja> y se abre members:<nueva>

Reglas que aplican aunque no lo parezca:
  - Regla 1: nada de esquema, RLS ni RPC. Si el arreglo lo pidiera, te paras
  - Regla 5: el filtro community_id=eq.<id> no se pierde. test:realtime sigue en 18/18 y, si añades
    una prueba de «dos suscriptores en la misma pantalla», sube y lo apuntas
  - Regla 6: nada nuevo en pantalla, pero si tocas un aviso de sincronización, no dice «al día»
  - Vocabulario: «lista» en los documentos, community en el código

Donde sí te paras:
  - si el fallo no se reproduce en un test antes de arreglarlo: me lo dices y pensamos
  - si el arreglo pide tocar data/ o el puerto en más de subscribeMembers
  - si test:realtime baja de 18/18
  - si la causa de la lista perdida es algo que borra la sesión de los móviles que actualicen al
    1.3.1: me lo dices en cuanto lo sepas, antes de seguir

Orden de trabajo:
  1. El test que reproduce «cannot add callbacks after subscribe()» con dos llamadas en el mismo
     componente
  2. El plan con las cuatro decisiones, y esperas mi OK
  3. El arreglo, con sus tests. architecture-guard sobre src/features/community y
     src/features/expenses al terminar, y después pr-review-toolkit:silent-failure-hunter sobre
     los hooks de suscripción. Uno detrás de otro, nunca a la vez
  4. La investigación de la lista perdida, con investigador-datos si hace falta seguir una clave de
     AsyncStorage hasta la pantalla
  5. Me das la orden de eas update --branch preview --environment preview con su mensaje, tras
     comprobar con git diff que no cambió nada nativo. Lo lanzo yo
  6. La prueba en el POCO con la skill probar-en-android: versionName 1.3.1, el pie con el id del
     update (segunda apertura), abrir Gastos, Miembros encima de Gastos, atrás, cambiar de lista con
     Gastos abierto y Gastos sin red. Un cambio de un miembro desde otra sesión llega a la pantalla;
     si no hay segundo móvil, desde npm run test:realtime o desde el panel, y dices cuál
  7. qa-runner y, el último, revisor-documentacion

Documentación que cambia:
  - fase-15.md: apartado nuevo con el arreglo, las decisiones, la causa de la lista perdida y la
    prueba en el POCO con la versión del pie
  - ROADMAP: el bloque «Estado» (Gastos ya no se cierra, la causa de la lista perdida y a dónde va
    su arreglo) y «Siguiente», que pasa a T-16.1 con su prompt en prompts/T-16-1-herramientas.md
  - expo-stack: la regla nueva, «un hook de lectura no abre canales»
  - docs/auditoria-2026-10-11.md no se toca: lo absorbido se apunta en fase-15.md

Terminado cuando:
  - el test del paso 1 falla antes del arreglo y pasa después
  - ninguna llamada a subscribeMembers queda dentro de un hook de lectura (grep)
  - el hook de suscripción a miembros hace refetch tras SUBSCRIBED, informa con onStatus y vuelve
    a pedir los miembros con useAppForeground, con un test de cada cosa
  - npm run typecheck limpio, npm run lint con 0 errores, npm test en verde con la cobertura de
    jest.config.js, test:realtime 18/18 o más, y los recuentos apuntados
  - en el POCO, con el update publicado y su id en el pie, Gastos se abre, se cierra y se vuelve a
    abrir sin cerrarse la app, también con Miembros encima y sin red
  - la causa de la lista perdida escrita en fase-15.md con su prueba, o qué falta para saberla

Al terminar: git status, qué entra en el commit, qué no y por qué, el mensaje en inglés y las
órdenes exactas.
```

## Lo que este prompt da por sentado

- Que el POCO sigue con la 1.3.1 `base` y que Alejandro activa los interruptores de depuración al
  empezar y los apaga al terminar.
- Que el error de Gastos es el del canal y no otro que lo tapaba. Si al arreglarlo sale un segundo
  cierre, es parte de este incremento.
- Que `adb run-as` funciona con el APK `preview`. Si el build no es depurable, la clave de
  AsyncStorage no se puede leer desde fuera y la causa se razona con un test.
