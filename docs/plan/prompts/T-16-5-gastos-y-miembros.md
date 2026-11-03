# Prompt de arranque · T-16 · Incremento 5 · Gastos y miembros

Rehace las pantallas de gastos (resumen, nuevo gasto, movimientos y detalle) y la de miembros con
sus diálogos, según el `DESIGN.md` del incremento 2. Gastos dejó de cerrar la app con el arreglo del
canal de miembros (`prompts/T-15-gastos.md`): esa regla, un hook de lectura no abre canales, no se
pierde al rehacer la pantalla.

Escrito el 2026-11-02 como incremento 6 y renumerado el 2026-11-03, cuando ADR-0028 sacó Recetas y
Menú de la app y su incremento desapareció. Si algo de aquí no coincide con `DESIGN.md` o con los
bocetos, mandan ellos.

Lo que se encuentra:

- Gastos ya es una pestaña (incremento 3), con AppHeader y la StatusStrip. Miembros ya tiene el
  código arriba, y su fila propia ya lleva «Tu PIN», que abre /members/pin del incremento 6 del
  T-15. Ni la pestaña ni el PIN se rehacen: se comprueba que encajan.
- ListRow, EmptyState y ErrorState del incremento 4, y ScreenHeader y ActionBar del 6 del T-15.
- Absorbe del bloque 3 del incremento 8 de la auditoría lo de MembersScreen (confunde un error con
  «vacío»), y del bloque 2 los mensajes concatenados de MembersScreen, AddGuestDialog y
  ConfirmRemoveMemberDialog, que pasan a interpolados aquí aunque la pantalla no cambie sus
  textos.
- No absorbe las mutaciones de miembros (use-set-member-admin, use-remove-member, use-add-guest),
  que siguen en el incremento 8 del T-15.

Recuentos de partida: los del bloque «Estado» del ROADMAP. Se pega tal cual en la sesión.

---

```
Vas a hacer el incremento 5 del paquete T-16 de docs/plan/ROADMAP.md: rehacer las pantallas de
gastos y la de miembros según DESIGN.md. domain/ calcula balances y liquidaciones; presentation/
cambia cómo se enseñan. Ni el cálculo ni las mutaciones cambian aquí.

No hagas commit, push, eas update, eas build ni supabase db push: los hooks los bloquean y los
lanzo yo. Tampoco adb uninstall ni maestro cloud. Si al empezar git status trae algo, dímelo antes
de tocar nada. Hay un .txt en docs/ que no se abre, no se lee y no entra en ningún commit.

El ritmo: me enseñas el plan y las decisiones de golpe, cada una con tu recomendación y la
alternativa que descartas. Si contesto «adelante», van como las propones. A partir de ahí solo te
paras en los casos de «Donde sí te paras».

Antes de nada, lee en este orden:
  1. DESIGN.md y docs/diseno/bocetos.html, los apartados «Gastos y miembros», «Miembros e
     invitación» y «Opciones de un miembro»
  2. docs/diseno/estado-de-partida.md, esas pantallas
  3. docs/adr/ADR-0005 (dinero en céntimos) y ADR-0017 (administrador)
  4. docs/phases/fase-15.md, el apartado del arreglo de Gastos: dónde se monta useMembersRealtime
  5. docs/auditoria-2026-10-11.md, «Incremento 8», bloques 2 y 3, solo lo de miembros
  6. La skill expo-stack: «Realtime», «Dónde vive cada estado» y «Errores: `data/` informa,
     `presentation/` traduce»

No explores fuera de esta lista y de src/features/expenses/presentation y
src/features/community/presentation (miembros y PIN). Para un símbolo, el LSP.

Dónde escribes:
  - src/features/expenses/presentation/ y la parte de miembros de
    src/features/community/presentation/
  - src/shared/ui/ solo si DESIGN.md pide un componente que aún no existe, y entonces lo añades a
    su tabla
  - src/shared/lib/i18n/es.json y en.json, a la vez, con los mensajes de miembros interpolados
  - la lista de excepciones del test de diseño: fuera las de estas pantallas
  - docs/phases/fase-16.md, docs/plan/ROADMAP.md

Qué no tocas:
  - domain/ de expenses: balances y liquidaciones están probados y no cambian por cómo se pintan
  - las mutaciones de miembros (incremento 8 del T-15)
  - la pantalla del PIN más allá de que encaje con la de miembros
  - dónde se monta la suscripción a miembros, salvo que la pantalla nueva lo pida: si cambia, con
    su test de «una sola suscripción por pantalla»

Decisiones que tienes que tomar:
  1. Cómo se escribe un importe con el teclado numérico y la coma decimal en español
  2. Cómo se distingue un invitado (sin la app) de un miembro, sin depender del color: recomiendo
     la segunda línea de la fila en texto («Invitada, sin la app»), como en el boceto del reparto
  3. Lo que falta por dibujar antes de escribir, y esperas OK: Todos los gastos y Gasto en todos
     sus estados, las casillas «Inc. T-16.5» de la matriz de DESIGN.md (cargando sin caché, error
     de carga y sin red en Gastos y Nuevo gasto, cargando y error en Miembros) y el Dialog de
     «Opciones de Bea» al 200 %. Se añaden a docs/diseno/bocetos.html
Ya decidido en el diseño, no se vuelve a abrir:
  - Gastos abre por los saldos: arriba tu saldo dicho en palabras y debajo quién debe a quién, con
    «Saldar» en cada fila, que se anuncia «Saldar con Bea, 12,00 €»
  - cifras con tabularNums y la etiqueta siempre encima, nunca pegada en la misma línea
  - Nuevo gasto sin teclado al entrar, el importe primero en text-3xl, quién pagó en un selector de
    una línea y Guardar en la ActionBar
  - Todos los gastos agrupado por mes; una liquidación lleva icono y la palabra «Liquidación»
  - Gasto con la cifra en text-4xl y Borrar abajo en danger, con «Deshacer» en el aviso
  - en Miembros, cada persona tiene un solo control, «Opciones de Bea», que abre un Dialog; quitar
    va separado y en danger
  - la presencia en texto, no como un punto de color

Casos límite y errores (ADR-0016):
  - sin red: un gasto nuevo entra en la cola con su id del cliente y el aviso dice que se enviará
  - error al cargar: el mensaje con su código entre paréntesis y reintentar, nunca «no hay gastos»
    ni «no hay miembros»
  - importes de 0,01 € y de 9.999,99 €, nombres de 40 caracteres, una lista con 12 miembros
  - un miembro quitado que tiene gastos: sale en movimientos y detalle (includeArchived)

Reglas que aplican aunque no lo parezca:
  - Regla 1: ADR-0005 (dinero en céntimos) y ADR-0017 (administrador) están aceptados; si el
    diseño pide otra cosa, te paras
  - Regla 5: un gasto o un miembro nunca sale de otra lista; un alta sin red no se pierde al
    reiniciar
  - Regla 6: un gasto sin red no dice «guardado»; el precio del catálogo no se convierte en gasto
    sin que alguien lo confirme
  - Vocabulario: «lista» en la interfaz

Donde sí te paras:
  - si el diseño pide cambiar el cálculo de balances o liquidaciones
  - si al rehacer Gastos vuelve a abrirse members:<id> dos veces (test:realtime o el test de la
    suscripción)

Orden de trabajo:
  1. El plan con las decisiones, y esperas mi OK
  2. Gastos, después miembros
  3. architecture-guard, después revisor-interfaz (dinero y estados), y
     pr-review-toolkit:silent-failure-hunter si tocaste un estado de error. Uno detrás de otro
  4. npm run test:realtime contra el real: 18/18 o el recuento que dejó el arreglo de Gastos
  5. Me das la orden de eas update o de build, según la versión del pie. Lo lanzo yo
  6. La prueba en el POCO con probar-en-android: el script de inspección con la letra al 100 % y al
     máximo, en claro y oscuro; un gasto con red y sin ella, cerrar la app y abrirla; Miembros
     encima de Gastos y atrás; añadir y quitar un invitado; TalkBack en el balance
  7. qa-runner y, el último, revisor-documentacion

Documentación que cambia:
  - fase-16.md: el incremento 5, con la medida antes y después
  - ROADMAP: el bloque «Estado» y lo absorbido del incremento 8 del T-15

Terminado cuando:
  - el script de inspección no marca nada en estas pantallas, o lo que marque está explicado
  - el test de diseño no tiene excepciones en expenses ni en la parte de miembros
  - test:realtime con su recuento y el guion de arriba en el POCO con capturas
  - npm run typecheck limpio, npm run lint con 0 errores, npm test en verde con la cobertura de
    jest.config.js, y los recuentos apuntados

Al terminar: git status, qué entra en el commit, qué no y por qué, el mensaje en inglés y las
órdenes exactas.
```

## Lo que este prompt da por sentado

- Que el arreglo de Gastos y el incremento 6 del T-15 están hechos y en el POCO.
- Que el `.env` con las claves de Realtime está en el ordenador donde se lance `test:realtime`.
