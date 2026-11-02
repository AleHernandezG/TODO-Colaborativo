# Prompt de arranque · T-16 · Incremento 3 · Navegación y cabecera

Primer incremento del T-16 que toca código. Monta la navegación que decidió ADR-0028 y la cabecera
nueva, y deja las pantallas de dentro como están: cada una se rehace en su incremento. Va detrás
del incremento 6 del T-15 (la pantalla del PIN y la migración B).

Este prompt se escribió el 2026-11-02, antes del diseño. El incremento 2 lo corrige si su reparto o
su ADR cambian lo que dice aquí; si la cabecera de abajo no coincide con `DESIGN.md`, manda
`DESIGN.md`.

Lo que se encuentra:

- ADR-0028 en Propuesto, `DESIGN.md` reescrito y los bocetos en `docs/diseno/bocetos.html`.
- La foto de partida (`docs/diseno/estado-de-partida.md`): la cabecera de la lista, con cinco
  botones, deja el título en 19 px con la letra al 115 %.
- Absorbe de la auditoría (incremento 7) los puntos 4 y 5: «Finalizar compra» y el detalle de
  receta navegan con `useGoToList()` y dejan dos listas montadas, y tocar una notificación hace
  `push` de la ruta en la que ya se está. El punto 6 (atrás en el modo supermercado) va al
  incremento 4.
- `pin-unirse.yaml` no puede comprobar «Estás dentro como Ana» porque la cabecera lo tapa.
- El blanco fijo sobre el primario no llega a AA en modo oscuro (fallo 23 de la auditoría). Se
  arregla aquí, en los componentes de `src/shared/ui`, porque los usan todas las pantallas.

Recuentos de partida: los del bloque «Estado» del ROADMAP tras el incremento 6 del T-15. Siguiente
ADR y pregunta libres: los que diga `docs/README.md` y `PREGUNTAS.md` al empezar; no los des por
sabidos.

Se pega tal cual en la sesión.

---

```
Vas a hacer el incremento 3 del paquete T-16 de docs/plan/ROADMAP.md: la navegación de ADR-0028 y
la cabecera nueva, con el selector de listas y el menú de lo que no cabe. Las pantallas de dentro
se quedan como están. presentation/ y src/app/ cambian; domain/ y data/ no.

No hagas commit, push, eas update, eas build ni supabase db push: los hooks los bloquean y los
lanzo yo. Tampoco adb uninstall ni maestro cloud. Si al empezar git status trae algo, dímelo antes
de tocar nada. Hay un .txt en docs/ que no se abre, no se lee y no entra en ningún commit.

El ritmo: me enseñas el plan y las decisiones de golpe, cada una con tu recomendación y la
alternativa que descartas. Si contesto «adelante», van como las propones. A partir de ahí solo te
paras en los casos de «Donde sí te paras».

Antes de nada, lee en este orden:
  1. docs/adr/ADR-0028-navegacion-por-pestanas.md
  2. DESIGN.md, navegación y cabecera, y docs/diseno/bocetos.html de esas dos cosas
  3. docs/diseno/estado-de-partida.md, la cabecera y lo que dice de la barra de abajo
  4. docs/auditoria-2026-10-11.md, «Incremento 7», puntos 4 y 5
  5. La skill expo-stack: «La pila y el botón atrás», y la skill expo-router del plugin expo
  6. docs/adr/ADR-0025-varias-listas-por-usuario-y-lista-activa.md, el selector

No explores fuera de esta lista y de src/app/ y src/shared/ui/. Para un símbolo, el LSP; para la API
de la navegación en la versión instalada, context7 o docs.expo.dev/versions/v57.0.0.

Dónde escribes:
  - src/app/: los _layout y las rutas que muevas
  - src/shared/ui/: la cabecera y lo que el diseño ponga como compartido para navegar
  - src/theme/tokens.js y su test: minTouchTarget pasa de 44 a 48 (P-02), y lo que se descoloque
    en pantallas que todavía no se han rehecho se apunta en fase-16.md, no se arregla aquí
  - src/features/community/presentation/: el selector de listas en la cabecera
  - src/features/notifications/presentation/ y donde viva useGoToList, para los puntos 4 y 5
  - src/shared/lib/i18n/es.json y en.json, a la vez
  - src/shared/lib/__tests__/: quitar de la lista de excepciones del test de diseño lo que arregles
  - .maestro/pin-unirse.yaml: la aserción de «Estás dentro como Ana» o la que la sustituya
  - docs/phases/fase-16.md, docs/plan/ROADMAP.md, la skill expo-stack si cambia la regla de la pila

Qué no tocas:
  - las pantallas de lista, modo supermercado, recetas, menú, gastos y miembros por dentro: son de
    los incrementos 4 a 6
  - domain/ y data/
  - app.json, el SDK y las dependencias, salvo que ADR-0028 lo diga y esté aceptado. Si pide build,
    la versión pasa a 1.4.0 con la skill publicar-version, y te paras antes de tocar app.json
  - ADR-0028 si está aceptado: el hook lo protege. Si la implementación pide apartarse, me lo dices

Decisiones que tienes que tomar:
  1. Qué pasa con las rutas que hoy se abren con push desde la lista (recetas, gastos, miembros)
     cuando pasan a ser pestañas o a estar en el menú: qué ruta queda, y que los enlaces de las
     notificaciones (communityId en sus datos) sigan llegando
  2. El botón atrás en cada pestaña: en la primera sale de la app, en las demás vuelve a la
     primera, o lo que diga ADR-0028. Explícito en el código, no por defecto
  3. Si ocultar o cambiar pestañas al cambiar de lista reinicia su estado (NativeTabs lo hace):
     cómo se evita o qué se pierde
  4. Cómo se queda la parte de las pantallas que hoy pone sus propios botones en la cabecera:
     recomiendo moverlos al menú en este incremento aunque la pantalla se rehaga después, para no
     tener dos cabeceras a la vez

Casos límite y errores (ADR-0016):
  - sin sesión o sin lista activa: la navegación no se monta hasta que se hidrata el store
    (AsyncStorage es asíncrono) y se va a la bienvenida
  - cambiar de lista con una pestaña abierta en otra pantalla de su pila
  - una notificación de otra lista: cambia la lista activa y lleva a su pantalla, sin apilar
  - letra al máximo: el título de la cabecera no baja de dos líneas legibles; las etiquetas de la
    barra se cortan o se esconden según DESIGN.md, nunca se aplastan
  - sin red: la navegación funciona igual; los avisos de cada pantalla no cambian

Reglas que aplican aunque no lo parezca:
  - Regla 1: ADR-0025 manda en el selector. No se añade un botón de salir de la lista
  - Regla 5: cambiar de lista cierra los canales de la vieja y abre los de la nueva; ninguna
    pantalla enseña datos de la lista anterior durante un render. Que lo cubra un test
  - Regla 6: ningún indicador nuevo de la cabecera dice «al día» si hay cola
  - Vocabulario: «lista» en la interfaz

Donde sí te paras:
  - si la navegación pide algo nativo que ADR-0028 no tenía previsto
  - si el selector de listas tiene que salir de la cabecera
  - si npx expo export --platform android falla

Orden de trabajo:
  1. El plan con las cuatro decisiones y la lista de rutas que cambian, y esperas mi OK
  2. La navegación y la cabecera, con sus tests de lo que tenga lógica (qué pestaña, qué hace
     atrás, la notificación)
  3. architecture-guard sobre src/app, src/shared/ui y lo tocado en las features; después
     revisor-interfaz sobre la cabecera y la barra. Uno detrás de otro
  4. npx expo export --platform android, y me das la orden de eas update o de build, según
     ADR-0028. Lo lanzo yo
  5. La prueba en el POCO con la skill probar-en-android: el script de inspección en la cabecera y
     la barra con la letra al 100 %, al 115 % y al máximo, en claro y oscuro; atrás en cada
     pestaña; cambiar de lista; una notificación; pin-unirse.yaml entero, con la aserción de Ana
  6. qa-runner y, el último, revisor-documentacion

Documentación que cambia:
  - fase-16.md: el incremento 3, sus decisiones y la prueba con la versión del pie, y la medida de
    la cabecera antes y después
  - expo-stack: la pila y el botón atrás con la navegación nueva
  - docs/guias/e2e-con-maestro.md: lo que cambie en los flujos
  - ROADMAP: el bloque «Estado»; los puntos 4 y 5 del incremento 7 del T-15 como hechos aquí

Terminado cuando:
  - el script de inspección no marca nada en la cabecera ni en la barra con la letra al máximo, o
    lo que marque está en fase-16.md con su motivo
  - el test de diseño pasa con menos excepciones que al empezar, y el número está apuntado
  - pin-unirse.yaml pasa entero en el POCO, aserción de Ana incluida
  - minTouchTarget vale 48 y tokens.test.ts lo comprueba
  - el texto sobre el primario llega a AA en claro y en oscuro (fallo 23), comprobado con
    Accessibility Scanner en el POCO
  - npm run typecheck limpio, npm run lint con 0 errores, npm test en verde con la cobertura de
    jest.config.js, y los recuentos apuntados
  - la versión del pie en el POCO es la del update o build de este incremento

Al terminar: git status, qué entra en el commit, qué no y por qué, el mensaje en inglés y las
órdenes exactas.
```

## Lo que este prompt da por sentado

- Que ADR-0028 está aceptado. Si sigue en Propuesto, la sesión lo pregunta antes de implementarlo.
- Que la navegación llega por aire. Si pide build, este incremento cierra cuando el APK 1.4.0 esté
  en el POCO, y la 1.3.1 deja de recibir updates del T-16.
