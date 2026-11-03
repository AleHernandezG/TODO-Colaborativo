# Prompt de arranque · T-16 · Incremento 3 · Pestañas, cabecera y fuera Recetas y Menú

Primer incremento del T-16 que toca código. Monta las dos pestañas de ADR-0028, la cabecera nueva y
las piezas compartidas que usarán los incrementos siguientes, y esconde Recetas y Menú. Las
pantallas de dentro se quedan como están salvo la tarjeta del código en Miembros: cada una se rehace
en su incremento. Va detrás del incremento 6 del T-15, que deja hechos `ScreenHeader` y `ActionBar`.

Reescrito el 2026-11-03, con el diseño ya hecho. Si algo de aquí no coincide con `DESIGN.md` o con
los bocetos, mandan ellos.

Lo que se encuentra:

- ADR-0028 (dos pestañas nativas, Lista y Gastos; Recetas y Menú fuera de la app), `DESIGN.md`
  reescrito y los bocetos en `docs/diseno/bocetos.html`.
- Todo lo nativo que pide ya está en el APK 1.3.1 (`08f58498`): `react-native-screens` 4.26.2 con
  su `gamma/tabs/host/`, y `expo-symbols` 57.0.3 en el árbol como dependencia de expo-router, que en
  Android no tiene código nativo. Va por update, sin build. Falta verlo en el POCO, y es lo primero.
- `src/theme/tokens.js` ya tiene `iconSize`, `rowMinHeight` y `tabLabelSize`, pero
  `src/theme/index.ts` no los exporta todavía.
- La foto de partida (`docs/diseno/estado-de-partida.md`): la cabecera de la lista, con cinco
  botones, deja el título en 19 px con la letra al 115 %.
- Absorbe de la auditoría (incremento 7) los puntos 4 y 5: «Finalizar compra» y el detalle de
  receta navegan con `useGoToList()` y dejan dos listas montadas, y tocar una notificación hace
  `push` de la ruta en la que ya se está. El detalle de receta desaparece con Recetas. El punto 6
  (atrás en el modo supermercado) va al incremento 4.
- `pin-unirse.yaml` no puede comprobar «Estás dentro como Ana» porque la cabecera lo tapa.
- El blanco fijo sobre el primario no llega a AA en modo oscuro (fallo 23). Se arregla aquí, en
  `src/shared/ui`, porque lo usan todas las pantallas.
- `design-rules-exceptions.json`: 21 entradas y 93 líneas al cerrar el T-16.2, de las que 7
  entradas (20 líneas) son de recipes y meal-planner. Esas se quedan aunque ya no tengan pantalla.

Recuentos de partida: los del bloque «Estado» del ROADMAP tras el incremento 6 del T-15. Siguiente
ADR y pregunta libres: los que diga `docs/README.md` y `PREGUNTAS.md` al empezar.

Se pega tal cual en la sesión.

---

```
Vas a hacer el incremento 3 del paquete T-16 de docs/plan/ROADMAP.md: las dos pestañas de
ADR-0028, AppHeader con el selector de listas, Icon, IconButton y StatusStrip en src/shared/ui,
minTouchTarget a 48, el fallo 23, la tarjeta del código en Miembros y quitar las pantallas de
Recetas y Menú. presentation/ y src/app/ cambian; domain/ y data/ no.

No hagas commit, push, eas update, eas build ni supabase db push: los hooks los bloquean y los
lanzo yo. Tampoco adb uninstall ni maestro cloud. Si al empezar git status trae algo, dímelo antes
de tocar nada: lo que haya es mío. Hay un .txt en docs/ que no se abre, no se lee y no entra en
ningún commit.

El ritmo: me enseñas el plan y las decisiones de golpe, cada una con tu recomendación y la
alternativa que descartas. Si contesto «adelante», van como las propones. A partir de ahí solo te
paras en los casos de «Donde sí te paras».

Antes de nada, lee en este orden:
  1. docs/adr/ADR-0028-navegacion-por-pestanas.md entero
  2. DESIGN.md entero. Es corto y todo lo que pintes sale de ahí
  3. docs/diseno/bocetos.html, los apartados «Navegación y cabecera» y «Casos límite»
  4. docs/auditoria-2026-10-11.md, «Incremento 7», puntos 4 y 5
  5. La skill expo-stack: «La pila y el botón atrás» y «Pulido visual y movimiento»
  6. docs/adr/ADR-0025-varias-listas-por-usuario-y-lista-activa.md, el selector

No explores fuera de esta lista y de src/app/, src/shared/ui/ y src/theme/. Para un símbolo, el
LSP. Para NativeTabs y expo-symbols en la versión instalada, context7 o
docs.expo.dev/versions/v57.0.0; el import es expo-router/unstable-native-tabs.

Dónde escribes:
  - src/app/: un grupo con el _layout de NativeTabs para list y expenses, sin cambiar sus URL, y
    fuera src/app/recipes/ y src/app/meal-planner/
  - src/shared/ui/: AppHeader, Icon, IconButton y StatusStrip, que sustituye a OfflineBanner y
    RealtimeStatus; el fallo 23 en Button y donde haya texto sobre primary
  - src/theme/: minTouchTarget a 48 en tokens.js con su test, y exportar iconSize, rowMinHeight y
    tabLabelSize desde index.ts
  - src/features/community/presentation/: el selector en AppHeader y la tarjeta del código arriba
    de Miembros, con Compartir como principal y Copiar y Generar como secundarias
  - src/features/*/presentation/: quitar los enlaces a recetas y menú, y los puntos 4 y 5
  - package.json y package-lock.json: npx expo install expo-symbols, que debe fijar la 57.0.3. Si
    propone otra versión, te paras
  - src/shared/lib/i18n/es.json y en.json, a la vez. Los textos que solo usaban las pantallas
    quitadas se quedan si los usa algo de features/recipes o meal-planner; si no, fuera
  - src/shared/lib/__tests__/design-rules-exceptions.json: bajar lo que arregles, y corregir los
    motivos que citan la numeración vieja (Miembros decía T-16.6 y es T-16.5; recetas y menú
    decían T-16.5 y pasan a «sin pantalla desde el T-16.3, ADR-0028»)
  - .maestro/pin-unirse.yaml: la aserción de «Estás dentro como Ana» o la que la sustituya
  - docs/phases/fase-16.md, docs/plan/ROADMAP.md, DESIGN.md (la tabla de componentes y el token a
    48) y la skill expo-stack si cambia la regla de la pila

Qué no tocas:
  - las pantallas de Lista, modo supermercado, Gastos y Miembros por dentro, salvo la tarjeta del
    código y quitar enlaces: son de los incrementos 4 y 5
  - domain/ y data/ de ninguna feature, y src/features/recipes y src/features/meal-planner: se
    quedan enteras, en el array features de eslint.config.js y en test:rls
  - app.json y el SDK. Si NativeTabs pide un build, te paras: la versión pasaría a 1.4.0
  - ADR-0028 si está aceptado: el hook lo protege. Si la implementación pide apartarse, me lo dices
  - las tablas, RPC y migraciones de recetas y menús

Decisiones que tienes que tomar:
  1. El primer paso es medir, antes de montar todo: un update mínimo con NativeTabs y dos pestañas
     en el POCO. Si no llega a la 1.3.1 sin build o «Gastos» se corta al 200 %, se cambia a Tabs
     de expo-router con la misma estructura. Recomiendo hacerlo con una rama de prueba del update,
     no con el canal preview; dime cuál usas
  2. Cómo se quitan Recetas y Menú: recomiendo borrar sus rutas de src/app y sus botones, y dejar
     sus pantallas en features/*/presentation sin exportar desde index.ts, para que volver sea
     reponer las rutas. Descartado borrar también las pantallas, que es lo que más trabajo da al
     volver
  3. Las notificaciones push de recetas o menú que lleguen a un móvil con el update: a dónde
     llevan. Recomiendo a la Lista de su communityId
  4. Cambiar de lista con una pestaña abierta: la key de la lista activa en el contenido de cada
     pestaña, sin navegar (ADR-0028). Que lo cubra un test
  5. «Ir a comprar» con la letra al 200 % y la franja encendida: mide cuántos artículos se ven en el
     POCO. Si son menos de dos, pasa de la ActionBar a la última fila de la lista (DESIGN.md, «Letra
     al 200 %»). Se apunta la cifra aunque no haga falta moverlo

Casos límite y errores (ADR-0016):
  - sin sesión o sin lista activa: las pestañas no se montan hasta que se hidrata el store
    (AsyncStorage es asíncrono) y se va a la bienvenida
  - cambiar de lista con Gastos abierto: sigue en Gastos de la otra lista, sin un render con datos
    de la vieja
  - una notificación de otra lista: cambia la lista activa y lleva a su pantalla, sin apilar
  - atrás: desde Gastos vuelve a Lista, desde Lista sale de la app. Explícito en el código y con test
  - letra al 200 %: el título de AppHeader a dos líneas y luego elipsis; la etiqueta de la pestaña
    no se corta, y si se corta es el criterio de la decisión 1
  - StatusStrip: sin red, «Comprobando» a los 2 s y servidor inalcanzable a los ~12 s con el código,
    con los textos de DESIGN.md. Es región viva para TalkBack
  - un móvil que se queda en la 1.3.1 sin el update sigue enseñando Recetas y Menú y escribiendo en
    sus tablas. Es esperado; no se arregla

Reglas que aplican aunque no lo parezca:
  - Regla 1: ADR-0025 manda en el selector. No se añade un botón de salir de la lista
  - Regla 5: cambiar de lista cierra los canales de la vieja y abre los de la nueva. Quitar Recetas
    y Menú no quita sus comprobaciones de test:rls
  - Regla 6: la StatusStrip nunca dice «al día», «guardado» ni «sincronizado»
  - Vocabulario: «lista» en la interfaz

Donde sí te paras:
  - si el update no llega a la 1.3.1 sin build, o si NativeTabs pide algo nativo
  - si npx expo install expo-symbols propone una versión distinta de 57.0.3
  - si el selector de listas tiene que salir de la cabecera
  - si npx expo export --platform android falla
  - si quitar Recetas y Menú rompe un test de domain/ o data/: algo de fuera los consume

Orden de trabajo:
  1. El plan con las cinco decisiones y la lista de rutas que cambian, y esperas mi OK
  2. La prueba mínima de la decisión 1 en el POCO, por adb y Maestro con la skill
     probar-en-android
  3. Pestañas, AppHeader, Icon, IconButton, StatusStrip, el token, el fallo 23 y la tarjeta del
     código, con tests de lo que tenga lógica (qué pestaña, qué hace atrás, la notificación, la key)
  4. Quitar Recetas y Menú
  5. architecture-guard sobre src/app, src/shared/ui, src/theme y lo tocado en las features;
     después revisor-interfaz sobre la cabecera, la barra y la franja. Uno detrás de otro
  6. npx expo export --platform android, git diff sin nada nativo salvo la línea de expo-symbols, y
     me das la orden de eas update. Lo lanzo yo
  7. La prueba en el POCO: npm run inspect:screen en Lista, Gastos y Miembros al 100 %, al 115 % y
     al 200 %, en claro y oscuro; atrás en cada pestaña; cambiar de lista; una notificación;
     pin-unirse.yaml entero, con la aserción de Ana
  8. qa-runner y, el último, revisor-documentacion

Documentación que cambia:
  - fase-16.md: el incremento 3, sus decisiones, la medida de la decisión 1 y de la 5, y la prueba
    con la versión del pie
  - DESIGN.md: componentes que pasan a «ya está» y minTouchTarget en 48
  - expo-stack: la pila y el botón atrás con las pestañas
  - docs/guias/e2e-con-maestro.md: lo que cambie en los flujos
  - ROADMAP: el bloque «Estado»; los puntos 4 y 5 del incremento 7 del T-15 como hechos aquí
  - docs/tecnica/STACK.md: expo-symbols con su versión, licencia y fecha
  - CLAUDE.md, la descripción del proyecto y las filas Receta y Menú semanal del vocabulario, y
    docs/tecnica/GLOSARIO.md con lo mismo: que están escondidas desde este incremento (ADR-0028).
    Hasta que se escondan, la app las tiene y esos textos dicen la verdad

Terminado cuando:
  - en el POCO hay dos pestañas, Lista y Gastos, y no se llega a Recetas ni a Menú desde ningún
    sitio, con la versión del pie del update de este incremento
  - npm run inspect:screen sale con 0 en AppHeader, la barra y la StatusStrip al 200 %, o lo que
    marque está en fase-16.md con su motivo
  - design-rules-exceptions.json tiene menos líneas que al empezar, y la cifra está apuntada
  - pin-unirse.yaml pasa entero en el POCO, aserción de Ana incluida
  - minTouchTarget vale 48 y tokens.test.ts lo comprueba
  - el texto sobre primary llega a AA en claro y en oscuro (fallo 23)
  - npm run typecheck limpio, npm run lint con 0 errores, npm test en verde con la cobertura de
    jest.config.js, npm ci --dry-run limpio, y los recuentos apuntados
  - test:rls con el mismo recuento que al empezar

Al terminar: git status, qué entra en el commit, qué no y por qué, el mensaje en inglés y las
órdenes exactas.
```

## Lo que este prompt da por sentado

- Que ADR-0028 está aceptado. Si sigue en Propuesto, la sesión lo pregunta antes de implementarlo.
- Que el incremento 6 del T-15 dejó `ScreenHeader` y `ActionBar` en `src/shared/ui`. Si no, este
  incremento los crea antes que AppHeader.
- Que la navegación llega por aire. Si pide build, este incremento cierra cuando el APK 1.4.0 esté
  en el POCO, y la 1.3.1 deja de recibir updates del T-16.
- Que nadie quiere volver a ver Recetas y Menú antes del cierre del T-16. Si se quiere, se reponen
  sus rutas y se rediseñan en un incremento nuevo.
