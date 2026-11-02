# Prompt de arranque · T-16 · Incremento 5 · Recetas y menú semanal

Rehace las pantallas de recetas (lista, detalle, nueva y editar) y la del menú semanal con sus dos
modales, según el `DESIGN.md` del incremento 2.

Escrito el 2026-11-02, antes del diseño. Si el incremento 2 cambió el reparto, manda lo que diga el
ROADMAP y este prompt se corrige.

Lo que se encuentra:

- En `DESIGN.md`, «Lo que hoy no cumple»: `text-content-muted` en MealPlannerScreen, que no existe.
- Absorbe del bloque 3 del incremento 8 de la auditoría lo de estas pantallas: área táctil y
  etiquetas en MealPlannerScreen, AssignMealModal, ConsolidatedReviewModal y las de recetas; los
  campos con etiqueta y no solo placeholder; el stepper de raciones, que lee lo mismo en el menos y
  en el más; RecipeDetailScreen, RecipesScreen y MealPlannerScreen, que confunden un error con
  «vacío»; y el refresco al tirar del menú.
- No absorbe el bloque 1 del incremento 8 (las mutaciones de recetas y menú, que no son optimistas
  ni encolables, y el «deshacer» al borrar una receta). Siguen en el T-15.

Recuentos de partida: los del bloque «Estado» del ROADMAP. Se pega tal cual en la sesión.

---

```
Vas a hacer el incremento 5 del paquete T-16 de docs/plan/ROADMAP.md: rehacer las pantallas de
recetas y la del menú semanal según DESIGN.md. domain/ ya consolida ingredientes y menús;
presentation/ cambia cómo se ven y se tocan. Las mutaciones no cambian aquí.

No hagas commit, push, eas update, eas build ni supabase db push: los hooks los bloquean y los
lanzo yo. Tampoco adb uninstall ni maestro cloud. Si al empezar git status trae algo, dímelo antes
de tocar nada. Hay un .txt en docs/ que no se abre, no se lee y no entra en ningún commit.

El ritmo: me enseñas el plan y las decisiones de golpe, cada una con tu recomendación y la
alternativa que descartas. Si contesto «adelante», van como las propones. A partir de ahí solo te
paras en los casos de «Donde sí te paras».

Antes de nada, lee en este orden:
  1. DESIGN.md y docs/diseno/bocetos.html, las pantallas de recetas y menú
  2. docs/diseno/estado-de-partida.md, esas pantallas
  3. docs/auditoria-2026-10-11.md, «Incremento 8», bloque 3, y los fallos 20 y 23 del apartado 6
  4. docs/adr/ADR-0021 (recetas), ADR-0022 (menú) y ADR-0023 (portada de recetas)
  5. La skill expo-stack: «Dónde vive cada estado» y «Errores: `data/` informa, `presentation/`
     traduce»

No explores fuera de esta lista y de src/features/recipes/presentation y
src/features/meal-planner/presentation. Para un símbolo, el LSP.

Dónde escribes:
  - src/features/recipes/presentation/ y src/features/meal-planner/presentation/
  - src/shared/ui/ si DESIGN.md pide un componente que aún no existe
  - src/shared/lib/i18n/es.json y en.json, a la vez
  - la lista de excepciones del test de diseño: fuera las de estas pantallas
  - docs/phases/fase-16.md, docs/plan/ROADMAP.md

Qué no tocas:
  - las mutaciones de recetas y menú (bloque 1 del incremento 8 del T-15): si el diseño pide
    «deshacer» al borrar una receta, lo dices y se queda para ese incremento
  - domain/ y data/ de las dos features
  - meal-planner/domain/meal-plan.ts y su import de @/features/recipes: es del incremento 8

Decisiones que tienes que tomar:
  1. Cómo se ve una semana del menú en un móvil estrecho con la letra al máximo: días en filas,
     una columna, o lo que diga el diseño. Con la recomendación de por qué
  2. Qué se enseña mientras se consolida el menú en la lista y qué si falla
  3. Los formularios largos de receta con el teclado abierto: la acción de guardar siempre a la
     vista

Casos límite y errores (ADR-0016):
  - sin red: lo que haya en caché, el aviso de sin conexión y ninguna acción que parezca hecha si
    no se envió
  - error al cargar: el mensaje con su código entre paréntesis y reintentar, nunca «no hay recetas»
  - una receta sin foto, con 30 ingredientes, con nombre de 40 caracteres; un menú vacío y uno
    lleno
  - raciones: el stepper dice «menos una ración» y «una ración más», y su valor

Reglas que aplican aunque no lo parezca:
  - Regla 1: ADR-0021, ADR-0022 y ADR-0023 están aceptados; si el diseño se aparta, te paras
  - Regla 5: las claves de query llevan el communityId; nada sale de otra lista
  - Regla 6: añadir una receta o un menú a la lista sin red no dice que ya está en la lista del
    grupo
  - Vocabulario: «lista» en la interfaz

Donde sí te paras:
  - si una pantalla no se puede rehacer sin tocar sus mutaciones
  - si un control no llega al área táctil de DESIGN.md sin cambiar el diseño

Orden de trabajo:
  1. El plan con las decisiones, y esperas mi OK
  2. Las pantallas de recetas, después la del menú y sus modales
  3. architecture-guard, después revisor-interfaz, y pr-review-toolkit:silent-failure-hunter si
     tocaste un estado de error. Uno detrás de otro
  4. Me das la orden de eas update o de build, según la versión del pie. Lo lanzo yo
  5. La prueba en el POCO con probar-en-android: el script de inspección en cada pantalla con la
     letra al 100 % y al máximo, en claro y oscuro; crear y editar una receta con el teclado
     abierto; asignar comidas y consolidar el menú en la lista; sin red; TalkBack en el menú y en
     el stepper
  6. qa-runner y, el último, revisor-documentacion

Documentación que cambia:
  - fase-16.md: el incremento 5, con la medida antes y después
  - ROADMAP: el bloque «Estado» y lo absorbido del incremento 8 del T-15

Terminado cuando:
  - el script de inspección no marca nada en estas pantallas, o lo que marque está explicado
  - el test de diseño no tiene excepciones en recipes ni meal-planner
  - el guion de arriba pasa en el POCO con capturas y con la versión del pie de este incremento
  - npm run typecheck limpio, npm run lint con 0 errores, npm test en verde con la cobertura de
    jest.config.js, y los recuentos apuntados

Al terminar: git status, qué entra en el commit, qué no y por qué, el mensaje en inglés y las
órdenes exactas.
```

## Lo que este prompt da por sentado

- Que el incremento 4 está cerrado y sus componentes compartidos existen.
- Que el bloque 1 del incremento 8 del T-15 no se ha hecho todavía. Si se hizo antes, el «deshacer»
  al borrar una receta ya existe y la pantalla lo enseña.
