# Prompt de arranque · T-16 · Incremento 4 · La lista y el modo supermercado

Rehace las dos pantallas de más uso según el `DESIGN.md` del incremento 2: la lista (con el alta de
artículos y la agrupación) y el modo supermercado. Son las que una persona que no sabe usar apps
tiene que poder manejar sin ayuda.

Escrito el 2026-11-02 y corregido el 2026-11-03 con el diseño del T-16.2. Si algo de aquí no
coincide con `DESIGN.md` o con los bocetos, mandan ellos.

Lo que se encuentra:

- Las pestañas, AppHeader, Icon, IconButton y StatusStrip del incremento 3, y ScreenHeader y
  ActionBar del incremento 6 del T-15. El código de invitación ya está arriba de Miembros (hallazgo
  4 resuelto en el 3).
- Recetas y Menú ya no tienen pantalla (ADR-0028), así que la lista solo se llena a mano o desde el
  catálogo.
- En la foto de partida: en el modo supermercado `fontSize: 13` y `borderRadius: 18` en línea.
- Lo que midió el incremento 3 sobre «Ir a comprar» con la letra al 200 % (decisión 5 de su
  prompt, en `fase-16.md`).
- Absorbe de la auditoría: el punto 6 del incremento 7 (el botón atrás del modo supermercado, que
  hoy va por defecto) y, del bloque 3 del incremento 8, lo de estas pantallas: área táctil y
  etiquetas en ShoppingModeScreen, el selector de agrupación de ItemsScreen y el chip de categoría
  de AddItemBar; la opción activa que solo se distingue por el fondo; y ShoppingModeScreen, que
  confunde un error con «vacío».

Recuentos de partida: los del bloque «Estado» del ROADMAP. P-01 está respondida: el texto del diálogo
de fin de compra se queda como está, y atrás en el modo supermercado puede acabar en ese diálogo. Se pega tal cual en la sesión.

---

```
Vas a hacer el incremento 4 del paquete T-16 de docs/plan/ROADMAP.md: rehacer la pantalla de la
lista y la del modo supermercado según DESIGN.md. domain/ ya decide qué artículos y en qué orden;
presentation/ cambia cómo se ven y cómo se tocan. La lógica no cambia.

No hagas commit, push, eas update, eas build ni supabase db push: los hooks los bloquean y los
lanzo yo. Tampoco adb uninstall ni maestro cloud. Si al empezar git status trae algo, dímelo antes
de tocar nada. Hay un .txt en docs/ que no se abre, no se lee y no entra en ningún commit.

El ritmo: me enseñas el plan y las decisiones de golpe, cada una con tu recomendación y la
alternativa que descartas. Si contesto «adelante», van como las propones. A partir de ahí solo te
paras en los casos de «Donde sí te paras».

Antes de nada, lee en este orden:
  1. DESIGN.md y docs/diseno/bocetos.html, el apartado «Lista y supermercado» y «Casos límite»
  2. docs/diseno/estado-de-partida.md, esas dos pantallas
  3. docs/auditoria-2026-10-11.md, fallos 20, 22 y 23 del apartado 6, solo lo de items y
     shopping-mode, y el punto 6 del «Incremento 7»
  4. docs/adr/ADR-0024-modo-supermercado-y-categorias-de-articulos.md y ADR-0014 (la foto)
  5. La skill expo-stack: estado, mutaciones optimistas y «deshacer»

No explores fuera de esta lista y de src/features/items/presentation, donde viven las dos
pantallas (ShoppingModeScreen incluida). Para un símbolo, el LSP.

Dónde escribes:
  - src/features/items/presentation/
  - src/shared/ui/: ListRow, EmptyState y ErrorState, como los describe DESIGN.md
  - src/shared/lib/i18n/es.json y en.json, a la vez
  - la lista de excepciones del test de diseño: fuera las de estas pantallas
  - .maestro/: los flujos que citen textos o testID que cambies
  - docs/phases/fase-16.md, docs/plan/ROADMAP.md

Qué no tocas:
  - domain/ y data/ de items: si el diseño necesita un dato nuevo (por ejemplo, contar por
    pasillo), es un caso de uso nuevo con su test, y lo dices en el plan
  - las mutaciones: siguen optimistas y encolables como están (ADR-0009, ADR-0010)
  - las pantallas de gastos y miembros, y lo que quede de recetas y menú en src/features

Decisiones que tienes que tomar:
  1. Qué hace atrás en el modo supermercado: recomiendo que con artículos marcados pregunte si se
     termina la compra, y sin ninguno vuelva sin preguntar. Escrito en el código, no por defecto
  2. Qué pasa con «deshacer» tras borrar en la fila nueva: el Snackbar de siempre, o el gesto que
     propongas dentro de DESIGN.md
  3. Dónde va «Ir a comprar» si el incremento 3 midió que con la letra al 200 % no caben dos
     artículos: la última fila de la lista, como dice DESIGN.md
  4. Lo que falta por dibujar antes de escribir, y esperas OK: EditItemDialog (nombre, Cantidad,
     Unidad, foto y Borrar, al 100 % y al 200 %), y de la matriz de estados de DESIGN.md las
     casillas «Inc. T-16.4»: modo supermercado vacío, y cargando sin caché y error de carga en
     las dos pantallas. Se añaden a docs/diseno/bocetos.html
  5. Cómo sabe la fila que su artículo tiene un cambio en la cola (P-05, respondida A): recomiendo
     un hook en presentation/hooks con useMutationState, filtrado por las mutationKey de items y
     por el id que llevan las variables, con su test. Descartado guardar un «pendiente» en la
     caché de la query, que habría que limpiar a mano y se queda colgado si la mutación falla
  6. Editar y Borrar como acciones de TalkBack sobre la fila (accessibilityActions): comprueba la
     API en React Native 0.86 con context7 antes de escribirla
Ya decidido en el diseño, no se vuelve a abrir:
  - el campo de añadir fijo arriba, bajo la cabecera, con las sugerencias del catálogo debajo y
    su precio orientativo con su antigüedad
  - comprado es tachado, texto muted y checkbox relleno con su marca; los comprados se pliegan al
    final en «Comprados (n)»
  - filas de rowMinHeight.default (56) en la lista y rowMinHeight.shopping (64) en el modo
    supermercado, con un solo control a la derecha
  - lista vacía: EmptyState con «Invitar a alguien» debajo y el campo de añadir arriba
  - el modo supermercado cierra con la cruz de ScreenHeader, «Salir del modo supermercado»
  - tocar la fila fuera del checkbox abre EditItemDialog; la fila no lleva botones de cantidad
  - TalkBack lee cada artículo en una parada, «Leche entera, cantidad 2, pendiente», y activarla
    lo marca
  - un artículo con un cambio en la cola lleva hourglass_top y «Se enviará al recuperar la
    conexión» en la segunda línea, y TalkBack lo lee con la fila (P-05, DESIGN.md «Conexión»).
    El dibujo de la decisión 4 incluye esa fila, también con una segunda línea que ya tenía precio

Casos límite y errores (ADR-0016):
  - sin red: marcar y añadir siguen funcionando y entran en la cola; el aviso dice que se enviará
    al recuperar la conexión, no que se guardó, y la fila lleva su marca hasta que el servidor
    acepta el cambio. Si el servidor lo rechaza, la marca se va con el rollback y sale el error
  - el texto nuevo de la marca pasa por forbidden-claims.test.ts en es.json y en.json
  - sin servidor o error al cargar: la pantalla lo dice con su código entre paréntesis y un
    reintentar, y no enseña «lista vacía»
  - 200 artículos (scripts/seed-200-items.mjs, contra una lista de prueba), nombre de 40
    caracteres, letra al máximo
  - un artículo sin foto, con foto del catálogo y con foto propia (ADR-0014)

Reglas que aplican aunque no lo parezca:
  - Regla 1: ADR-0014 (foto) y ADR-0024 (categorías) están aceptados; si el diseño se aparta,
    te paras
  - Regla 5: nada de lo que se pinte sale de otra lista; las claves de query siguen llevando el
    communityId
  - Regla 6: el precio de referencia sale con su antigüedad y «orientativo», y el estado de
    sincronización no dice «al día» con cola
  - Vocabulario: «lista» en la interfaz

Donde sí te paras:
  - si el diseño de una de estas dos pantallas no se puede hacer sin tocar domain/ o data/ más
    allá de un caso de uso nuevo
  - si un control no llega al área táctil de DESIGN.md sin cambiar el diseño
  - si cambia un texto que cita forbidden-claims.test.ts
  - si atrás en el modo supermercado pide cambiar el texto del diálogo de fin de compra, que se
    decidió en P-01

Orden de trabajo:
  1. El plan con las decisiones, y esperas mi OK
  2. Las dos pantallas y sus componentes
  3. architecture-guard sobre lo tocado, después revisor-interfaz sobre las dos pantallas, y
     pr-review-toolkit:silent-failure-hunter si tocaste un catch o un estado de error. Uno detrás
     de otro
  4. Me das la orden de eas update o de build, según la versión del pie. Lo lanzo yo
  5. La prueba en el POCO con probar-en-android: el script de inspección en las dos pantallas con
     la letra al 100 % y al máximo, en claro y oscuro; añadir, marcar, borrar y deshacer con red y
     sin ella; atrás en el modo supermercado con y sin marcados; 200 artículos; TalkBack en la fila
     y en el alta
  6. qa-runner y, el último, revisor-documentacion

Documentación que cambia:
  - fase-16.md: el incremento 4, con la medida antes y después de cada pantalla
  - DESIGN.md si un componente compartido nuevo no estaba descrito
  - ROADMAP: el bloque «Estado» y lo absorbido del T-15 (incremento 7, punto 6; incremento 8,
    bloque 3, lo de items y modo supermercado)

Terminado cuando:
  - el script de inspección no marca nada en las dos pantallas, o lo que marque está explicado
  - el test de diseño no tiene excepciones en estas pantallas
  - en el POCO, con la versión del pie de este incremento, el guion de arriba pasa con capturas
  - npm run typecheck limpio, npm run lint con 0 errores, npm test en verde con la cobertura de
    jest.config.js, y los recuentos apuntados

Al terminar: git status, qué entra en el commit, qué no y por qué, el mensaje en inglés y las
órdenes exactas.
```

## Lo que este prompt da por sentado

- Que el incremento 3 está cerrado y la navegación nueva está en el POCO.
- Que `seed-200-items.mjs` sigue escribiendo solo en la lista que se le pasa.
