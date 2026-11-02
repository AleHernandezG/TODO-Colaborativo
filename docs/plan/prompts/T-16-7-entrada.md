# Prompt de arranque · T-16 · Incremento 7 · Bienvenida, crear una lista y unirse

Rehace las tres pantallas por las que se entra: la bienvenida (`src/app/index.tsx`), crear una
lista y unirse con código, nombre y PIN. Es lo primero que ve una persona nueva y lo que más le
cuesta a quien no sabe usar apps.

Escrito el 2026-11-02, antes del diseño. Si el incremento 2 cambió el reparto, manda lo que diga el
ROADMAP y este prompt se corrige.

Lo que se encuentra:

- Los mensajes de unirse del incremento 6 del T-15, según el estado que devuelve `join_community`.
  No cambian aquí: se enseñan con el diseño nuevo.
- `pin-unirse.yaml` recorre estas pantallas y cita sus textos y testID. Tiene que seguir pasando.
- `join_community` solo devuelve seis estados, porque los APK instalados no conocen otros
  (ADR-0026).

Recuentos de partida: los del bloque «Estado» del ROADMAP. Se pega tal cual en la sesión.

---

```
Vas a hacer el incremento 7 del paquete T-16 de docs/plan/ROADMAP.md: rehacer la bienvenida,
crear una lista y unirse según DESIGN.md. domain/ decide qué estado de unirse pide qué mensaje;
presentation/ cambia cómo se ve. Ni las RPC ni los estados cambian.

No hagas commit, push, eas update, eas build ni supabase db push: los hooks los bloquean y los
lanzo yo. Tampoco adb uninstall ni maestro cloud. Si al empezar git status trae algo, dímelo antes
de tocar nada. Hay un .txt en docs/ que no se abre, no se lee y no entra en ningún commit.

El ritmo: me enseñas el plan y las decisiones de golpe, cada una con tu recomendación y la
alternativa que descartas. Si contesto «adelante», van como las propones. A partir de ahí solo te
paras en los casos de «Donde sí te paras».

Antes de nada, lee en este orden:
  1. DESIGN.md y docs/diseno/bocetos.html, las tres pantallas
  2. docs/diseno/estado-de-partida.md, esas pantallas
  3. docs/adr/ADR-0011 (join_code), ADR-0025 (entrar con useEnterCommunity) y ADR-0026 (los seis
     estados de join_community)
  4. docs/phases/fase-15.md, el apartado del incremento 6: los mensajes de unirse
  5. .maestro/pin-unirse.yaml

No explores fuera de esta lista, src/app/index.tsx, create.tsx, join.tsx y
src/features/community/presentation (crear y unirse). Para un símbolo, el LSP.

Dónde escribes:
  - src/app/index.tsx, create.tsx y join.tsx, y las pantallas de community que montan
  - src/shared/lib/i18n/es.json y en.json, a la vez
  - la lista de excepciones del test de diseño: fuera las de estas pantallas
  - .maestro/pin-unirse.yaml si cambian textos o testID
  - docs/phases/fase-16.md, docs/plan/ROADMAP.md

Qué no tocas:
  - join_community, create_community y sus estados: regla 1
  - cómo se entra en la lista: siempre useEnterCommunity, nunca setMembership directo
  - el botón de crear se queda en carga hasta tener el join_code: es la excepción a la regla de
    mutaciones optimistas

Decisiones que tienes que tomar:
  1. Cómo se escribe el código de invitación (mayúsculas, sin O/0 ni I/1, el guion) para que se
     pueda dictar por teléfono
  2. Si nombre y PIN van en la misma pantalla que el código o en un paso aparte, con la letra al
     máximo y el teclado abierto
  3. Qué ve quien ya tiene listas al abrir la app: la última lista, el selector o la bienvenida

Casos límite y errores (ADR-0016):
  - sin red: ni crear ni unirse se encolan; la pantalla dice que no hay conexión y el botón vuelve
    a estar disponible
  - sin servidor: timeout, que se dice como tal y no como «código incorrecto»
  - los seis estados de join_community, cada uno con su mensaje, y el código caducado con cómo
    pedir uno nuevo
  - el código pegado con espacios o en minúsculas
  - sin red, el aviso tarda unos 12 s (hallazgo 5 de fase-15.md, apartado 13): la pantalla enseña
    que lo está intentando, como diga DESIGN.md. El timeout de data/ no se toca aquí

Reglas que aplican aunque no lo parezca:
  - Regla 1: nada de RPC ni de estados nuevos
  - Regla 5: entrar en una lista no deja datos de la anterior en pantalla
  - Regla 6: crear una lista no dice nada de «sincronizado»
  - Vocabulario: «lista» en la interfaz, nunca «comunidad» ni «grupo» como nombre de la cosa

Donde sí te paras:
  - si el diseño pide un estado de unirse que join_community no devuelve
  - si pin-unirse.yaml deja de pasar por algo que no sea un texto o un testID

Orden de trabajo:
  1. El plan con las decisiones, y esperas mi OK
  2. Las tres pantallas
  3. architecture-guard, después revisor-interfaz, y pr-review-toolkit:silent-failure-hunter sobre
     el flujo de unirse. Uno detrás de otro
  4. Me das la orden de eas update o de build, según la versión del pie. Lo lanzo yo
  5. La prueba en el POCO con probar-en-android: pin-unirse.yaml entero; el script de inspección
     con la letra al 100 % y al máximo, en claro y oscuro; sin red; código caducado; atrás en cada
     paso; TalkBack en el formulario de unirse
  6. qa-runner y, el último, revisor-documentacion

Documentación que cambia:
  - fase-16.md: el incremento 7, con la medida antes y después
  - docs/guias/e2e-con-maestro.md si cambian los selectores
  - ROADMAP: el bloque «Estado»; «Siguiente» es el incremento 8, el cierre

Terminado cuando:
  - pin-unirse.yaml pasa entero en el POCO con la versión del pie de este incremento
  - el script de inspección no marca nada en estas pantallas, o lo que marque está explicado
  - el test de diseño no tiene excepciones en estas pantallas
  - npm run typecheck limpio, npm run lint con 0 errores, npm test en verde con la cobertura de
    jest.config.js, y los recuentos apuntados

Al terminar: git status, qué entra en el commit, qué no y por qué, el mensaje en inglés y las
órdenes exactas.
```

## Lo que este prompt da por sentado

- Que el incremento 6 del T-15 está cerrado y la migración B aplicada. Si no, los mensajes de unirse
  son los de la A y el prompt se corrige.
