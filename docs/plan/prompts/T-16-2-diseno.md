# Prompt de arranque · T-16 · Incremento 2 · El diseño, sin código

Con la foto de partida del incremento 1 se decide cómo van a ser las pantallas: la navegación, la
cabecera, dónde va cada acción y qué componentes compartidos hacen falta. Sale un `DESIGN.md`
nuevo, un ADR de navegación y unos bocetos que Alejandro aprueba. No se escribe código de pantalla:
lo hacen los incrementos 3 a 7, y antes el 6 del T-15, que pinta la pantalla del PIN con este
diseño.

Lo que se encuentra:

- `docs/diseno/estado-de-partida.md`, del incremento 1, con lo que falla en cada una de las 16
  rutas medido en el POCO.
- La cabecera de la lista lleva cinco botones. Material 3 pone de 3 a 5 destinos en la barra de
  navegación de abajo y manda lo secundario al menú de desbordamiento.
- En el SDK 57 hay dos caminos para las pestañas: `expo-router/unstable-native-tabs` (la barra
  nativa de Android, API inestable, se mueve a `expo-router/native-tabs` en el SDK 58) y las
  pestañas de JavaScript de Expo Router. Cuál de los dos va en un update por aire sobre la 1.3.1 y
  cuál pide un build nuevo está sin comprobar.
- `DESIGN.md` dice plano, texto grande, un solo acento y una acción principal a todo el ancho. Eso
  se queda salvo que la foto diga que no funciona.

Recuentos de partida: los que deje el incremento 1. P-02 está respondida: 48 dp con 8 dp de
separación para todo el diseño, aunque el token minTouchTarget siga en 44 hasta el T-16.3.
Siguiente ADR libre: 0028;
siguiente pregunta libre: P-05.

Se pega tal cual en la sesión.

---

```
Vas a hacer el incremento 2 del paquete T-16 de docs/plan/ROADMAP.md: el diseño de las pantallas,
sin código. Sale un DESIGN.md reescrito, un ADR de navegación, unos bocetos y el reparto de
pantallas entre los incrementos 3 a 7. Las pantallas no se tocan.

No hagas commit, push, eas update, eas build ni supabase db push: los hooks los bloquean y los
lanzo yo. Si al empezar git status trae algo, dímelo antes de tocar nada: lo que haya es mío. Hay un
.txt en docs/ que no se abre, no se lee y no entra en ningún commit.

El ritmo: me enseñas el plan y las decisiones de golpe, cada una con tu recomendación y la
alternativa que descartas. Si contesto «adelante», van como las propones. Los bocetos son la
excepción: me los enseñas antes de escribir DESIGN.md, porque es lo que más me cuesta juzgar en
texto.

Antes de nada, lee en este orden:
  1. docs/diseno/estado-de-partida.md: lo que hay que arreglar, ordenado
  2. docs/plan/ROADMAP.md, ficha del T-16
  3. DESIGN.md entero y src/theme/tokens.js
  4. docs/especificacion-y-roadmap.md, solo la lista RF-1 a RF-16: qué tiene que caber en la app
  5. docs/adr/ADR-0004 (Paper solo para superposiciones) y ADR-0025 (lista activa y selector)
  6. docs/plan/PREGUNTAS.md, la respuesta de P-02
  7. Las skills expo-router y expo-design-system del plugin expo. expo-native-ui solo para ver qué
     difiere en iOS; cuando choque con Material, gana Material

No explores src/ más allá de src/app/ (la lista de rutas) y src/shared/ui/ (lo que ya hay de
componentes). Para la API exacta de NativeTabs en la versión instalada, context7 o
docs.expo.dev/versions/v57.0.0, no la memoria.

Fuentes que tienes que mirar, y citar con fecha en lo que escribas:
  - Material 3: navegación (m3.material.io, navigation bar y top app bar) y
    developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns
  - Accesibilidad en Android: developer.android.com/guide/topics/ui/accessibility/apps
  - Apps del mismo tipo, para ver qué resuelven y cómo, no para copiarlas: listas de la compra
    compartidas (Bring!, Listonic, AnyList, OurGroceries), gastos compartidos (Splitwise, Tricount)
    y recetas y menús (Paprika, Mealime). De cada una, lo que haga mejor que nosotros en una
    pantalla concreta, con el enlace a su web o a su ficha de Google Play
  No se usa ningún recurso de pago, ni plantillas con licencia que no sea MIT, Apache-2.0, BSD o
  dominio público. Los iconos salen de lo que ya está instalado.

Dónde escribes:
  - DESIGN.md: reescrito. Mantiene sus secciones de carácter, tokens, «Lo que no se hace» y
    accesibilidad, y añade navegación, cabecera, patrones por tipo de pantalla y los componentes
    compartidos que hacen falta
  - docs/adr/ADR-0028-navegacion-por-pestanas.md (nuevo, con la skill adr), en Propuesto
  - src/theme/tokens.js solo si el diseño pide un token nuevo, y en el mismo cambio que DESIGN.md
  - docs/diseno/bocetos.html (nuevo): los bocetos, una pantalla por bloque, en claro y oscuro, con
    los tokens reales. Publícalo también como artifact para que lo vea en el móvil
  - docs/phases/fase-16.md, docs/plan/ROADMAP.md, y los prompts de los incrementos 3 a 8 si el
    reparto cambia lo que dicen

Qué no tocas:
  - src/ salvo tokens.js: el código es de los incrementos siguientes
  - el SDK, app.json y las dependencias. Si la navegación elegida pide algo nativo, se dice en el
    ADR con su coste y decide Alejandro
  - lo que DESIGN.md prohíbe (sombras, segundo acento, animar la entrada de pantallas) sin decirlo
    en el ADR o en una pregunta

Decisiones que tienes que tomar:
  1. La navegación. NativeTabs frente a las pestañas de JavaScript de Expo Router, y frente a
     seguir con una pila y una pantalla de inicio. Para cada una: si llega por aire a la 1.3.1 o
     pide un build (compruébalo, no lo deduzcas: qué parte nativa usa y si está en el APK de
     react-native-screens 4.26 instalado), qué hace con la letra al máximo, con TalkBack, con el
     botón atrás y con el teclado. Recomendación tuya, en ADR-0028
  2. Qué destinos van abajo y cuáles al menú. Con 3 a 5 destinos: la lista, recetas y menú, gastos,
     y lo demás (miembros, código de invitación, PIN, cambiar de lista) donde lo decidas
  3. La cabecera: título de la lista y selector de listas con la letra al máximo sin aplastarse, y
     cuántas acciones caben. Lo que no quepa va al menú o a otra pantalla
  4. El código de invitación: que no esté a dos deslizamientos (hallazgo 4)
  5. Los componentes compartidos nuevos en src/shared/ui (cabecera, fila de lista, estado vacío,
     estado de error, barra de acción principal) y cuáles de los de hoy se quedan
  6. El reparto entre los incrementos 3 a 7. El propuesto en el ROADMAP es: 3 navegación y
     cabecera; 4 lista y modo supermercado; 5 recetas y menú; 6 gastos y miembros; 7 bienvenida,
     crear y unirse. Cámbialo si el diseño lo pide y corrige sus prompts
  7. Qué tiene que saber el incremento 6 del T-15 para la pantalla del PIN: dónde vive, cómo se
     llega y qué componentes usa. Lo escribes en su prompt, docs/plan/prompts/T-15.md

Casos límite que el diseño tiene que resolver por escrito:
  - letra del sistema al máximo en la lista, la cabecera y la barra de abajo
  - el teclado abierto en el alta de artículos y en los formularios largos (gastos, recetas)
  - sin red y sin servidor: dónde sale el aviso y que no tape la acción principal
  - una lista vacía, una lista de 200 artículos y una lista con nombre de 40 caracteres
  - modo oscuro con el primario como fondo: el blanco fijo no llega a AA (fallo 23 de la
    auditoría). Lo implementa el incremento 3, que toca los componentes de src/shared/ui
  - sin red, el aviso tarda unos 12 s y es el de servidor inalcanzable (hallazgo 5 de fase-15.md,
    apartado 13): qué se enseña mientras tanto. Bajar el timeout es de data/ y no entra en el T-16
  - TalkBack: el orden de lectura de la cabecera y de la barra de abajo

Reglas que aplican aunque no lo parezca:
  - Regla 1: ADR-0004 y ADR-0025 están aceptados. Si el diseño se aparta de ellos (otra librería
    de superposiciones, quitar el selector del título), te paras y lo preguntas
  - Regla 3: nada de pago, tampoco fuentes ni iconos
  - Regla 5: un diseño que enseñe datos de varias listas a la vez (un resumen de todas) dice de
    dónde sale cada dato y cómo se filtra por community_id, o no sale
  - Regla 6: el diseño de los avisos de sincronización no dice «guardado» ni «al día» si puede
    estar en la cola, y el precio del catálogo sale como orientativo y con su antigüedad
  - Vocabulario: la interfaz dice «lista», nunca «comunidad»

Donde sí te paras:
  - si la navegación recomendada pide un build nuevo: me das el coste (versión 1.4.0, build, y que
    nada del T-16 llegue a la 1.3.1 hasta entonces) y decido
  - si el diseño quita una funcionalidad de las RF-1 a RF-16 o la esconde a más de dos toques

Orden de trabajo:
  1. Las fuentes y las apps de referencia, con lo que sacas de cada una en una tabla corta
  2. El plan con las siete decisiones, y esperas mi OK
  3. Los bocetos, y esperas mi OK
  4. ADR-0028, DESIGN.md y tokens.js si hace falta. revisor-interfaz sobre DESIGN.md y los
     bocetos: que lo escrito se pueda comprobar en pantalla
  5. Los prompts de los incrementos 3 a 8 y el del 6 del T-15, ajustados al diseño, con la skill
     prompt-de-paquete
  6. qa-runner y, el último, revisor-documentacion

Documentación que cambia:
  - DESIGN.md, ADR-0028 y la fila de docs/README.md
  - fase-16.md: las decisiones, las fuentes con fecha y lo que se descartó
  - ROADMAP: el bloque «Estado» y «Siguiente», que pasa al incremento 6 del T-15
  - docs/plan/prompts/T-15.md y T-16-3 a T-16-8, si cambian
  - CLAUDE.md, «UX y accesibilidad», solo si cambia una regla que se sigue siempre (el área táctil
    ya cambió con P-02), y el agente revisor-interfaz en el mismo cambio

Terminado cuando:
  - los bocetos de las 15 pantallas de `src/app/` aprobados por mí, en claro y oscuro, y con la lista y la cabecera
    también con la letra al máximo
  - ADR-0028 escrito, con si llega por aire o pide build comprobado en la documentación de la
    versión instalada
  - DESIGN.md reescrito, sin un valor que no esté en tokens.js
  - cada incremento del 3 al 8 con sus pantallas y su prompt al día, y el del 6 del T-15 con la
    pantalla del PIN según el diseño
  - npm test en verde (el test de diseño del incremento 1 sigue pasando con tokens.js)

Al terminar: git status, qué entra en el commit, qué no y por qué, el mensaje en inglés y las
órdenes exactas.
```

## Lo que este prompt da por sentado

- Que el incremento 1 dejó `docs/diseno/estado-de-partida.md` con las 15 pantallas medidas. Si faltan
  pantallas, el diseño de esas va sin foto y se dice.
- Que la sesión puede publicar un artifact. Si no, los bocetos se abren desde el fichero HTML.
