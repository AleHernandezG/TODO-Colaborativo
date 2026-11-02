# Prompt de arranque · T-16 · Incremento 1 · Herramientas para medir las pantallas y foto de partida

Abre el paquete T-16, el rediseño de las pantallas (P-04, respuesta A con A1). Antes de dibujar
nada hace falta saber qué falla en cada pantalla, y medirlo en el POCO, no a ojo. Este incremento
monta dos herramientas y saca la foto de partida de las 15 pantallas de `src/app/`. No toca ninguna pantalla.

Lo que se encuentra:

- El hallazgo 2 del apartado 13 de `fase-15.md` (título en 19 px `[66,160][85,769]` con la letra al
  115 %) salió leyendo a mano un XML de `uiautomator`. Nadie lo habría visto en un test: Jest no
  mide pantallas.
- `DESIGN.md` tiene «Lo que hoy no cumple» (colores que no existen, `fontSize: 13` y
  `borderRadius: 18` en línea) y la auditoría apunta más en sus fallos 20 y 23. Nada impide que
  vuelva a pasar: no hay un test que lo cace.
- El plugin `expo` ya está instalado y trae skills de diseño y navegación que el T-16
  usará: `expo-router` (NativeTabs), `expo-design-system`, `expo-animation` y `expo-native-ui`.
  Esta última sigue la guía de Apple y aquí manda Android.

Lo que se miró el 2026-11-02 y se descartó, para no volver a ello: Maestro MCP (`maestro mcp`,
Apache-2.0) trae tres herramientas de Maestro Cloud que se saltarían el hook, y en HyperOS
`launchApp` sigue bloqueado; las skills de Callstack (`callstackincubator/agent-skills`, MIT) no
están en el marketplace oficial y su parte de navegación es para React Navigation a pelo;
`frontend-design` y `playground` son para la web. Si en este incremento sale una razón nueva para
alguno, se dice y decide Alejandro.

Recuentos de partida: los que deje el arreglo de Gastos en el bloque «Estado» del ROADMAP. Si no
hay cifras nuevas, Jest con 68 suites y 490 tests, `test:hooks` 103/103, lint con 0 errores y 9
avisos. Preguntas abiertas que le afectan: P-02 (44 pt o 48 dp), que fija el umbral del script.
Siguiente ADR libre: 0028; siguiente pregunta libre: P-05.

Hace falta el POCO por USB con los interruptores de depuración activados.

Se pega tal cual en la sesión.

---

```
Vas a hacer el incremento 1 del paquete T-16 de docs/plan/ROADMAP.md: un script que mide una
pantalla del Android a partir de su árbol de uiautomator, un test que caza los valores de estilo
fuera de los tokens, y la foto de partida de las 15 pantallas de `src/app/` medida con el script. No cambias ninguna
pantalla. El script calcula; el test vigila; la foto se queda en un documento.

No hagas commit, push, eas update, eas build ni supabase db push: los hooks los bloquean y los
lanzo yo. Tampoco adb uninstall ni maestro cloud. Si al empezar git status trae algo, dímelo antes
de tocar nada: lo que haya es mío. Hay un .txt en docs/ que no se abre, no se lee y no entra en
ningún commit.

El ritmo: me enseñas el plan y las decisiones de golpe, cada una con tu recomendación y la
alternativa que descartas. Si contesto «adelante», van como las propones. A partir de ahí solo te
paras en los casos de «Donde sí te paras».

Antes de nada, lee en este orden:
  1. docs/plan/ROADMAP.md, ficha del T-16
  2. docs/phases/fase-15.md, apartado 13, el hallazgo 2: es el caso que el script tiene que cazar
  3. DESIGN.md entero y src/theme/tokens.js: lo que el test da por bueno
  4. src/shared/lib/__tests__/repository-rules.test.ts: la forma que sigue el test nuevo
  5. docs/guias/e2e-con-maestro.md, desde «En Windows, sin tocar el PATH»
  6. La skill probar-en-android
  7. docs/plan/PREGUNTAS.md, P-02

No explores fuera de esta lista. Para un símbolo, el LSP antes que leer ficheros enteros.

Dónde escribes:
  - scripts/: el script de inspección. La parte que lee el XML y decide, separada de la que
    llama a adb, para poder probarla con un XML de ejemplo
  - package.json: una entrada en "scripts" (sin dependencias nuevas: no cambia el lock)
  - src/shared/lib/__tests__/: el test de reglas de diseño
  - .claude/skills/probar-en-android/SKILL.md: cuándo y cómo se usa el script
  - docs/diseno/estado-de-partida.md (nuevo): la foto de partida
  - fuera del repo, ~/tools/capturas/2026-11/: las capturas y los XML. En el repo no van imágenes
  - docs/phases/fase-16.md (nuevo), docs/plan/ROADMAP.md, docs/README.md (índice) y
    docs/tecnica/ESTRUCTURA.md si el script o docs/diseno/ no encajan en lo que dice

Qué no tocas:
  - src/ salvo el test nuevo: las pantallas son de los incrementos 3 a 7
  - DESIGN.md: lo reescribe el incremento 2
  - las dependencias: sin parser de XML externo. El árbol de uiautomator es plano y basta con
    leer sus atributos; si no basta, te paras y comparas dos librerías antes
  - los ajustes del POCO que cambies para medir (tamaño de letra, modo oscuro): se dejan como
    estaban al terminar, y apuntas cómo estaban al empezar

Lo que mide el script, de una pantalla (adb exec-out uiautomator dump /dev/tty o dump a fichero y
adb pull, lo que funcione en HyperOS):
  - controles pulsables (clickable o long-clickable) de menos del umbral en ancho o alto, en dp,
    con la densidad que da adb shell wm density
  - textos cuyo ancho no llega a dos caracteres de su tamaño, como los 19 px del título
  - controles pulsables sin text ni content-desc, que TalkBack lee como «botón» y nada más
  - controles que se salen de la pantalla o se pisan entre ellos
  Salida legible en la terminal y en JSON, para pegarla en el documento.

Lo que caza el test de diseño, en src/app y src/features/*/presentation:
  - fontSize, borderRadius, padding y margin numéricos en style={…}
  - colores en hexadecimal o rgb() fuera de src/theme
  - clases de NativeWind que nombran un color que no está en tokens.js (text-content-muted,
    bg-accent, amber-*)
  - text-primary y bg-primary sin su variante dark:
  Lo que hay hoy entra en una lista de excepciones con fichero y motivo. La lista solo puede
  bajar: cada incremento del T-16 quita las de sus pantallas y el 8 la deja vacía.

Decisiones que tienes que tomar:
  1. El umbral del área táctil. Si P-02 está respondida, el suyo. Si no, recomiendo que el script
     avise a 48 dp y falle a 44 pt, y que el documento enseñe las dos columnas. Descartado:
     decidir P-02 aquí
  2. Qué hace el test con una línea nueva fuera de las excepciones: fallar. Descartado: un aviso,
     que nadie lee
  3. Las variantes de la foto: claro y oscuro con letra al 100 %, y claro con letra al 115 % y al
     máximo que permita HyperOS. Recomiendo no hacer oscuro con letra máxima en todas: solo en las
     tres pantallas de más uso (lista, modo supermercado y gastos)
  4. Qué datos tiene la lista de prueba al medir: los que dejó pin-unirse más artículos, recetas,
     un menú y gastos suficientes para que ninguna pantalla salga vacía. Tu propuesta, en una
     lista de prueba nueva o en «E2E PIN», nunca en una de otra persona

Casos límite y errores:
  - adb sin móvil o el dump vacío: el script sale con código distinto de 0 y un mensaje que dice
    qué falta, sin un JSON a medias
  - HyperOS no deja hacer dump con un diálogo del sistema delante: se apunta y se mide sin él
  - una ruta que necesita un id (expenses/[id], recipes/[id]): se mide con uno de la lista de
    prueba y se dice cuál
  - Supabase en pausa (plan Free): las pantallas salen con el error de servidor inalcanzable. Se
    mide igual y se apunta, pero no vale como foto de esa pantalla

Reglas que aplican aunque no lo parezca:
  - Regla 1: nada de esquema, RLS ni RPC
  - Regla 3: adb, uiautomator y Accessibility Scanner son gratis. Nada de servicios de pago
  - Regla 5: los datos de prueba van a una lista de prueba; el script no escribe en Supabase
  - Regla 6: si una pantalla dice «guardado» o «al día» sin red, se apunta como hallazgo
  - Vocabulario: «lista» en los documentos

Donde sí te paras:
  - si el script necesita una dependencia
  - si el test de diseño encuentra más de 60 líneas: me das la cifra por fichero antes de escribir
    la lista de excepciones, porque igual hay que cambiar la regla y no la lista
  - si el POCO no tiene la versión que dice el bloque «Estado» del ROADMAP

Orden de trabajo:
  1. El plan con las cuatro decisiones, y esperas mi OK
  2. El script con su test sobre un XML de ejemplo sacado del POCO (la cabecera de la lista con la
     letra al 115 %, que tiene que dar el título como aplastado)
  3. El test de diseño y su lista de excepciones. architecture-guard sobre lo que hayas tocado en
     src/
  4. La foto de partida en el POCO, con la skill probar-en-android: cada ruta en cada variante,
     captura, XML y salida del script. Restaura los ajustes del móvil
  5. docs/diseno/estado-de-partida.md: una tabla por pantalla con lo que falla, ordenado por lo
     que impide usarla. Es lo que lee el incremento 2
  6. qa-runner y, el último, revisor-documentacion

Documentación que cambia:
  - fase-16.md nuevo: qué se hizo, las decisiones, cómo se usa el script y qué se midió con qué
    versión
  - probar-en-android: el paso del script, con su orden exacta
  - docs/tecnica/METODO-DE-TRABAJO.md, sección 6 (tests que vigilan reglas): el test de diseño;
    sección 7 (plugins): lo descartado el 2026-11-02 de arriba, con su motivo
  - ROADMAP: el T-16 pasa a abierto, y «Siguiente» es el incremento 2 con su prompt en
    prompts/T-16-2-diseno.md
  - CLAUDE.md, «Órdenes»: la orden del script de inspección
  - DESIGN.md, «Lo que hoy no cumple»: remite a la lista de excepciones del test en vez de
    repetirla

Terminado cuando:
  - el script da el título de la cabecera como aplastado en el XML de ejemplo y su test pasa
  - el test de diseño pasa con su lista de excepciones, y falla con una sonda (un fontSize: 13 en
    una pantalla) que luego quitas
  - las 15 pantallas medidas en las variantes decididas, con la versión del pie apuntada
  - docs/diseno/estado-de-partida.md escrito, con el recuento de controles por debajo de cada
    umbral
  - npm run typecheck limpio, npm run lint con 0 errores, npm test en verde con la cobertura de
    jest.config.js, y los recuentos apuntados
  - los ajustes del POCO como estaban

Al terminar: git status, qué entra en el commit, qué no y por qué, el mensaje en inglés y las
órdenes exactas.
```

## Lo que este prompt da por sentado

- Que el arreglo de Gastos está hecho y publicado por aire. Si no, Gastos se mide con su cierre y la
  foto de esa pantalla no vale.
- Que `uiautomator dump` funciona en HyperOS con los interruptores activados. Si no, la foto se hace
  con capturas y Accessibility Scanner, y el script queda para cuando funcione.
- Que la lista de prueba se puede llenar de datos sin molestar a nadie.
