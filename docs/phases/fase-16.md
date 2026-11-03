# Fase 16: Rediseño de las pantallas

- **Fecha:** 2026-11-02 (abierta con el incremento 1)
- **Estado:** Incrementos 1 y 2 hechos: las herramientas, la foto de partida y el diseño sin código.
  Del 3 al 7, pendientes. El paquete tenía ocho incrementos y queda en siete al salir Recetas y Menú.
- **Commit:** pendiente, lo hace Alejandro.
- **Decisión de fondo:** [P-04](../plan/PREGUNTAS.md#p-04--alcance-y-orden-del-rediseño) y la
  ficha del T-16 en el [ROADMAP](../plan/ROADMAP.md). La navegación, en
  [ADR-0028](../adr/ADR-0028-navegacion-por-pestanas.md), propuesto el 2026-11-03.

---

## 1. Qué problema resuelve

El 2026-11-02, en el POCO con la letra al 115 %, la cabecera de la lista dejó el título en 19 px de
ancho y el selector de listas con él. Ningún test lo vio: Jest no pinta, Maestro buscaba un texto
que estaba en el árbol aunque no se viera, y `DESIGN.md` lo prohibía en un párrafo que nadie
comprobaba. Antes de rediseñar quince pantallas hacía falta poder medir una en el móvil y que un
test parase lo que se sale de los tokens. Este incremento monta las dos cosas y saca la foto de
cómo está todo antes de tocar nada.

## 2. Qué se hizo, por incrementos

### Incremento 1: herramientas y foto de partida

**`npm run inspect:screen`**, el script que mide la pantalla que esté delante en el Android.

- `scripts/inspect-screen.mjs` habla con `adb`: saca el árbol con
  `adb exec-out uiautomator dump /dev/tty`, la densidad (`wm density`), el tamaño (`wm size`), la
  escala de letra (`settings get system font_scale`), el modo oscuro (`cmd uimode night`), la
  `versionName` y la captura. Busca `adb` en el `PATH` o en `~/tools/platform-tools`, o en la
  variable `ADB`.
- `scripts/lib/screen-audit.ts` es la parte pura, sin Node, y la que lleva los tests: lee el XML,
  convierte a dp y marca lo que falla.
- uiautomator **deja fuera del XML** un texto de 0 px de ancho («Skipping invisible child»), que es
  justo lo que pasa con un texto aplastado. El script apunta la hora del móvil, hace el volcado y
  lee del logcat, desde esa hora, las líneas con la etiqueta `AccessibilityNodeInfoDumper`. Así salen «E2E PIN» y «Estás dentro como
  Ana», que en el XML no están.
- Marca, con los umbrales de P-02: pulsables (`clickable` o `long-clickable`) por debajo de 48 dp
  en ancho o alto, y aparte los que no llegan a 44, el valor de hoy de `minTouchTarget`;
  separaciones de menos de 8 dp entre dos pulsables; pulsables que se pisan, sin nombre para
  TalkBack, con la misma etiqueta o fuera de la pantalla; y textos aplastados (más estrechos que
  dos caracteres de la letra más pequeña). Un pulsable cortado por el borde del scroll no se mide:
  sale como aviso aparte.
- Lee la versión del pie (`v1.3.1 · <id>`) si está en pantalla.
- Sale con 0 si no marca nada, con 2 si marca y con 1 si no pudo medir.

**`src/shared/lib/__tests__/design-rules.test.ts`**, el test que caza los estilos fuera de
`DESIGN.md`. Recorre `src/app` y `src/features/*/presentation` y falla con:

- un número en `fontSize`, `gap`, un radio, `padding` o `margin` (el 0 vale);
- un hexadecimal, `rgb()` o `hsl()`;
- una clase con un color que no está en los tokens (`text-content-muted`, `bg-accent`), con un radio
  fuera de `sm`, `md`, `lg` y `full`, o con un valor arbitrario `-[...]`;
- un color de los tokens sin su pareja `dark:...-dark` en la misma cadena;
- `allowFontScaling={false}`.

Lo que ya estaba entra en `design-rules-exceptions.json`: 21 entradas y 93 líneas, una por fichero y
regla, con su recuento y un motivo que dice qué incremento del T-16 la quita. El test falla si una
línea sube, si aparece una línea en un fichero o regla nuevos, y también si una baja sin bajar el
número de la lista, para que nadie se olvide de apretar la tuerca.

**La foto de partida**, en [`docs/diseno/estado-de-partida.md`](../diseno/estado-de-partida.md),
con las capturas, los XML, los logcat y la salida del script en `~/tools/capturas/2026-11/`, fuera
del repo.

### Incremento 2: el diseño, sin código

El 2026-11-03. Lo único que toca `src/` es `src/theme/tokens.js`.

- **[`DESIGN.md`](../../DESIGN.md) reescrito.** Además de color, letra y forma, ahora dice cómo se
  navega y en cuántos toques se llega a cada cosa, qué cabecera lleva cada pantalla, qué componente
  de `src/shared/ui` crea cada incremento, qué hace el teclado, qué dice la franja de conexión en
  cada caso, la matriz de estados por pantalla, la tabla de iconos, el orden de TalkBack en la
  Lista y lo que manda con la letra al 200 %.
- **[ADR-0028](../adr/ADR-0028-navegacion-por-pestanas.md)**, propuesto: dos pestañas en la barra
  nativa, Lista y Gastos, con `NativeTabs` y los iconos de `expo-symbols`. Todo lo nativo ya está
  en el APK 1.3.1, así que va por update, sin la 1.4.0.
- **Los bocetos** en [`docs/diseno/bocetos.html`](../diseno/bocetos.html), publicados también como
  Artifact privado. Cada pantalla en claro, en oscuro y al 200 %, con una nota por decisión y el
  incremento que la pinta.
- **`tokens.js`** con tres tokens nuevos: `iconSize` (24), `rowMinHeight` (56 y 64 en el modo
  supermercado) y `tabLabelSize` (14). `minTouchTarget` sigue en 44 y lo sube el T-16.3. Ninguno
  se exporta todavía desde `@/theme`: lo hace el T-16.3 cuando los use.
- **Los prompts** de lo que sigue: el incremento 6 del T-15 con la pantalla del PIN dibujada, y del
  T-16.3 al T-16.7, renumerados.
- [P-05](../plan/PREGUNTAS.md#p-05--marca-de-pendiente-de-enviar-en-cada-fila), respondida el mismo
  día que se abrió: opción A, la marca en la fila.

Verificado en el PC; no hay prueba en el POCO porque no cambia nada que corra en el móvil. Los
números, en el apartado 3.

## 3. Verificación

**En el POCO F5**, el 2026-11-03, con la 1.3.1 y el update `01a19e5d` (pie `v1.3.1 · 01a19e5d`):

- Las quince pantallas medidas con `npm run inspect:screen` en claro y oscuro al 100 %, claro al
  115 % y al 200 %, y oscuro al 200 % en lista, modo supermercado y gastos. Más la parte de abajo
  de la lista al 100 %. El resultado está en
  [`estado-de-partida.md`](../diseno/estado-de-partida.md).
- Se repitieron dos medidas que salieron mal: Crear al 200 %, que pilló la cortina de
  notificaciones, y la lista en oscuro al 200 %, que salió desplazada. Repetidas dan lo mismo que su
  pareja en claro.
- El script caza los tres casos de la fase 15, apartado 14: los 44 dp con 3,3 dp de separación en
  Miembros, «Hacer admin» repetido cuatro veces y el título de la lista aplastado a 19 px (más dos
  textos a 0 px que solo salen del logcat).
- La bienvenida solo sale sin sesión. Con el OK de Alejandro se lanzó `adb shell pm clear` sobre la
  app (borra la sesión anónima, la caché y la cola del móvil, no toca Supabase), se midió desde el
  lanzador y se volvió a entrar en «E2E PIN» como Ana con su PIN. `pm clear` también resetea los
  permisos: Android volvió a pedir el de notificaciones y se aceptó.
- Ajustes del móvil antes de empezar: `font_scale` 1.15, modo oscuro activado,
  `stay_on_while_plugged_in` 0 y `screen_off_timeout` 600000. Durante la medida se puso
  `stay_on_while_plugged_in` a 7. Al terminar se dejaron los cuatro como estaban y se comprobaron
  con `settings get` y `cmd uimode night`.

**En el PC:**

- `npm run lint`: 0 errores y los 9 avisos que ya estaban. `npm run typecheck`: limpio.
  `npm run test:coverage`: 74 suites y 530 tests en verde, 91,45 % de líneas en lo que mide `jest.config.js`.
  Son 20 más que los 510 de la fase 15: 16 de `screen-audit` y 4 de `design-rules`.
- `scripts/__tests__/screen-audit.test.ts`: 16 tests contra volcados reales del POCO en
  `scripts/__fixtures__/`.
- `design-rules.test.ts` en verde con la lista de excepciones, y tres sondas que se quitaron
  después: un `fontSize: 13` en `src/app/create.tsx`, que no tiene excepción, falla con «1 línea(s)
  nueva(s)»; el mismo en `MovementsScreen.tsx`, que tiene una, falla con «2 líneas y la lista admite
  1»; y subir esa entrada a 2 sin tocar el código falla con «quedan 1 líneas. Baja la lista de 2 a
  1».

**Incremento 2, en el PC**, el 2026-11-03:

- `npm run lint`: 0 errores y los mismos 9 avisos. `npm run typecheck`: limpio.
  `npm run test:coverage`: 74 suites y 530 tests, 91,45 % de líneas, igual que al cerrar el
  incremento 1. `tokens.test.ts` sigue en verde con los tres tokens nuevos.
- Los bocetos abiertos en el navegador a 412 dp de ancho, en claro, en oscuro y con la letra al
  200 %, y su script pasado por `node --check` tras los arreglos del revisor.

## 4. Cómo se usa el script

Con el móvil por USB y la pantalla que se quiere medir delante, desde Git Bash:

```bash
npm run inspect:screen
npm run inspect:screen -- --label lista-claro-115 --out ~/tools/capturas/2026-11/claro-115
npm run inspect:screen -- --json
```

Sin argumentos imprime el resumen y las marcas. `--out` guarda `<label>.xml`, `.log`, `.png`,
`.json` y `.txt`. Para volver a medir un volcado guardado, sin móvil:

```bash
npm run inspect:screen -- --xml ~/tools/capturas/2026-11/claro-115/list.xml --log ~/tools/capturas/2026-11/claro-115/list.log --density 440 --font-scale 1.15
```

Para llegar a cada pantalla se usó el enlace profundo con la app en frío:

```bash
~/tools/platform-tools/adb.exe shell am force-stop com.alejandrohernandez.listacompra
~/tools/platform-tools/adb.exe shell am start -W -a android.intent.action.VIEW -d "listacompra://recipes" com.alejandrohernandez.listacompra
```

Con la app ya abierta, el enlace la dejó en «Conectando…» y la medida no valía. Las variantes se
ponen con `adb shell settings put system font_scale <n>` y `adb shell cmd uimode night yes|no`.

El script no ve el `hitSlop`: uiautomator da el rectángulo de la vista, no el área que acepta el
toque. `ItemRow` y `Checkbox` crecen 8 dp por cada lado con `hitSlop={8}` y el script los da por
más pequeños de lo que son. Al revés no falla: lo que marca por encima de 48 está bien.

## 5. Decisiones sobre la marcha

### El script marca a 48 dp y enseña aparte los de 44

Es la decisión 1 del prompt. P-02 dice 48 con 8 de separación, y el token `minTouchTarget` sigue en
44 hasta el T-16.3. Si el script marcase a 44, hoy saldría casi limpio y el T-16.3 lo pondría todo
en rojo de golpe. Marcando a 48 se ve la distancia real, y la columna de 44 dice cuántos están por
debajo incluso de lo que pide el código de hoy. Los dos umbrales están fijos en
`scripts/lib/screen-audit.ts`, no se leen de `tokens.js`: el script mide contra P-02, no contra el
token, y cuando el token suba a 48 la columna de 44 sobrará y se quitará.

### Una línea nueva fuera de la lista hace fallar el test

Decisión 2 del prompt. Un aviso no lo lee nadie, y `DESIGN.md` ya prohibía todo esto en texto.

### 21 entradas y 93 líneas, por encima del límite de 60

El prompt pedía parar si salían más de 60 líneas. Salieron 89 en 16 ficheros, casi la mitad en
`ShoppingModeScreen` y `MealPlannerScreen`, y Alejandro eligió escribir la lista con una entrada por
fichero y regla en vez de cambiar las reglas. La propuesta decía 22 entradas; al escribirla son 21.
Las 89 de la pregunta son 93 en la lista final, porque las expresiones regulares se afinaron
después de hacerla. Una entrada por fichero, sin separar por regla, dejaría cambiar un fallo por
otro sin que el test se enterase.

### El trinquete cuenta líneas, no casos

El test compara cuántas líneas distintas hay por fichero y regla. En un fichero con excepción se
puede quitar una línea mala y meter otra nueva sin que falle. Contar cada caso por su texto se
rompería con cualquier cambio de formato de Prettier, y para lo que es (que la deuda no crezca hasta
que el T-16 la vacíe) basta. Lo nuevo lo mira `revisor-interfaz`.

### `src/shared/ui` queda fuera del test

`Dialog.tsx` y `PickerDialog.tsx` ajustan el relleno de Paper con números, que es la forma de
hacerlo con Paper. El T-16.3 rehace `src/shared/ui`; si entonces quedan números, ese incremento
decide si la carpeta entra en el test.

### Fuera: la opacidad y el «posible corte»

`opacity-60` en `RecipeDetailScreen.tsx` no lo caza ninguna regla, porque `DESIGN.md` fija las
opacidades de pulsado y deshabilitado pero no prohíbe otras. Se deja para el `DESIGN.md` nuevo del
T-16.2.

El script tuvo un aviso de «posible corte»: estimaba el ancho de un texto por su número de
caracteres y el tamaño de letra deducido del alto del nodo. Con los volcados reales dio unas cuarenta
marcas a la letra al 100 % y las que se miraron eran falsas: Tailwind fija la altura de línea de
cada tamaño (`text-base` es 16 sobre 24, `text-lg` 18 sobre 28), así que el alto no dice el tamaño,
y un texto en dos líneas parecía uno largo en una. Tampoco podía acertar: uiautomator devuelve el
texto entero aunque en pantalla salga cortado con «…». Se quitó, con su test. Un corte se ve en la
captura.

### Los scripts con lógica se parten en `.mjs` y `lib/*.ts`

`ESTRUCTURA.md` decía que los scripts van en `.mjs`. El de inspección tiene lógica que merece tests,
y Jest no la cubre si vive en el `.mjs` que llama a `adb`. La parte pura va en
`scripts/lib/screen-audit.ts` y el `.mjs` la importa con `node --experimental-strip-types` (Node
24.22), igual que `catalog:ingest` importa `normalized-name.ts` del dominio del catálogo. La
diferencia es que esta lógica no es de ninguna feature y no pinta nada en `src/`. No hay dependencia
nueva. `ESTRUCTURA.md` lo recoge.

### La lista de prueba es «E2E PIN»

Decisión 4 del prompt. La dejó `pin-unirse` en la fase 15 y el POCO está dentro como Ana. Se sembró
con `node --env-file=.env` y la clave publicable, entrando como Eva (PIN 5678) por
`join_community`: 25 artículos en 10 pasillos, 12 con foto del catálogo, 4 comprados y uno de nombre
largo; tres recetas, una de título largo; cinco huecos del menú de la semana del 2 de noviembre;
cuatro gastos y una liquidación de Ana a Eva. El invitado no entró: `add_guest_member` exige admin
(`42501`) y Eva no lo es. El primer intento, el que falló ahí, dejó un usuario anónimo sin miembro;
lo limpia `npm run users -- --delete-orphans`, que lanza Alejandro.

### Recetas y Menú semanal salen de la app (incremento 2)

Al ver los bocetos, Alejandro dijo que el apartado de recetas sobraba y que quería la app simple por
ahora. Se le preguntó por el Menú, que sin recetas no tiene contenido (ADR-0022), y salió también.
Se esconden, no se borran: el T-16.3 quita las rutas `src/app/recipes/` y `src/app/meal-planner/` y
lo que enlace a ellas; las features, sus tests, sus tablas, sus RPC y las recetas guardadas se
quedan. Se descartó borrarlo todo porque deshacerlo costaría una migración y rehacer dos features,
y la decisión es «por ahora». RF-14 y RF-15 quedan fuera de la app hasta nueva orden.

Con eso el paquete pierde un incremento: el antiguo T-16.5, recetas y menú, desaparece y los
siguientes bajan un número (gastos y miembros es el 5, la entrada el 6 y el cierre el 7).

### Dos pestañas abajo, no arriba ni sin pestañas (incremento 2)

Con dos destinos, Material recomienda pestañas arriba. Se le propusieron a Alejandro tres formas y
eligió la barra de abajo: está donde la busca quien no sabe usar apps y es la misma si vuelve un
tercer destino. Lo descartado y por qué está en ADR-0028.

Lo que se comprobó en `node_modules` antes de escribirlo: `expo-router` 57.0.25 trae
`unstable-native-tabs` sobre el `Tabs.Host` de `react-native-screens` 4.26.2, que ya está compilado
en el APK; `expo-symbols` 57.0.3 no declara código nativo para Android y dibuja los iconos con la
fuente de `@expo-google-fonts/material-symbols`. La medida en el POCO queda para el primer paso del
T-16.3, que si falla cambia a la barra en JS.

### Las fuentes, consultadas el 2026-11-03 (incremento 2)

Las de la navegación, en el apartado «Fuentes» de ADR-0028. Para el resto de `DESIGN.md`:

- Material 3, [Navigation bar](https://m3.material.io/components/navigation-bar/guidelines): alto
  de 80 dp e indicador del destino activo.
- Android, [Accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps):
  48 dp de área táctil y 8 dp de separación, la cifra de P-02.
- Material 3, [Top app bar](https://m3.material.io/components/top-app-bar/guidelines), para la
  cabecera con el título a dos líneas.
- Apps del mismo tipo, para ver dónde ponen el campo de añadir, el código de invitación y el
  reparto: [Bring!](https://www.getbring.com/en/home), [OurGroceries](https://www.ourgroceries.com/overview),
  [AnyList](https://www.anylist.com/features), Listonic en Google Play,
  [Splitwise](https://www.splitwise.com/) y [Tricount](https://www.tricount.com/). Solo se miró su
  disposición; no se copia nada de su aspecto.

Las acciones personalizadas de TalkBack (`accessibilityActions`) no se consultaron en esta sesión:
el T-16.4 comprueba su API en React Native 0.86 con context7 antes de usarlas.

### Lo que encontró `revisor-interfaz` en el diseño (incremento 2)

19 hallazgos sobre `DESIGN.md` y los bocetos. Todos se arreglaron en el mismo cambio salvo uno, que
pide una decisión:

- **Arreglados en los bocetos:** el texto de la lista vacía, la tarjeta «Ponte un PIN» debajo del
  campo de añadir, la marca `check` en el chip seleccionado, el desplegado de «Comprados», el icono
  de los gastos, el radio de los botones de icono, el texto de espera de Crear, «visto hace 6 días»,
  la línea de precios orientativos bajo las sugerencias, un miembro sin admin en Miembros y la cifra
  de contraste del fallo 23, que es 2,5:1 (2,54 con la fórmula de WCAG).
- **Arreglados en `DESIGN.md`:** la matriz de estados por pantalla, la franja en las dos pestañas,
  el código de invitación sin red, qué cuenta como un toque, que tocar la fila abre
  `EditItemDialog`, la regla de una acción principal (la única con relleno `primary`), trece iconos
  que faltaban en la tabla, cómo se ve lo seleccionado sin depender del color, las acciones de
  TalkBack, el scroll y el código de invitación al 200 %, los radios, el borde de una tarjeta que
  pide algo, el verbo de la carga, la atribución de Open Food Facts y la presencia sin red.
- **A una pregunta:** si cada artículo encolado lleva su marca en la fila, en P-05. Alejandro
  eligió la A tras el commit del incremento: la marca va en la segunda línea de la fila, la pinta
  el T-16.4 y está en `DESIGN.md`, apartado «Conexión».
- **A los prompts:** los estados que faltan por dibujar (cargando sin caché, error de carga, los
  diálogos al 200 %) los dibuja cada incremento antes de escribirlos, y espera OK. El T-16.4 dibuja
  además `EditItemDialog`.

## 6. Deuda asumida

- El script no ve el `hitSlop` (apartado 4).
- El test de diseño cuenta líneas, no casos, y no mira `src/shared/ui` ni las opacidades.
- uiautomator da los rectángulos recortados a lo visible. Un botón que se sale por el borde mide lo
  que queda dentro y no sale «fuera de pantalla» (Guardar en editar receta al 200 %). Los desbordes
  se ven en la captura, no en el `.txt`.
- La letra al 200 % es la que acepta `font_scale` por `adb`. No se comparó con el máximo del
  deslizador de HyperOS, que puede ser otro.
- Dos usuarios anónimos huérfanos, el de la siembra y el que dejó `pm clear`, hasta que se lance
  `npm run users -- --delete-orphans`.
- Del incremento 2: los estados de la matriz de `DESIGN.md` marcados «Inc.» no están dibujados. Cada
  incremento los dibuja antes de escribir su pantalla.
- Del incremento 2: la etiqueta de la barra nativa al 200 % y que el update llegue a la 1.3.1 están
  razonados en el código, no medidos en el POCO. Es el primer paso del T-16.3.
- Del incremento 2: las 7 entradas de recetas y menú se quedan para siempre en
  `design-rules-exceptions.json` mientras esas pantallas no vuelvan.
