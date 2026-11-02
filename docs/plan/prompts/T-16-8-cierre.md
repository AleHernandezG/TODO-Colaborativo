# Prompt de arranque · T-16 · Incremento 8 · Cierre del rediseño

Cierra el T-16: una pasada por todas las pantallas con TalkBack, la letra al máximo y el modo
oscuro, la lista de excepciones del test de diseño vacía, los flujos de Maestro al día y la skill
`cerrar-paquete`.

Escrito el 2026-11-02, antes del diseño. Lo que diga el ROADMAP al llegar aquí manda sobre él.

Lo que se encuentra:

- Los incrementos 3 a 7 con sus pantallas rehechas, cada uno con su medida antes y después en
  `fase-16.md`.
- `camino-feliz.yaml` y `cola-offline.yaml` desfasados desde la fase 15 (no rellenan el PIN y el
  primero pulsa «Salir de esta lista», que ya no existe). Con la navegación nueva, más.
- La foto de partida en `docs/diseno/estado-de-partida.md`, para comparar.

Recuentos de partida: los del bloque «Estado» del ROADMAP. Se pega tal cual en la sesión.

---

```
Vas a cerrar el paquete T-16 de docs/plan/ROADMAP.md: comprobar las 15 pantallas de src/app contra DESIGN.md en
el POCO, dejar vacía la lista de excepciones del test de diseño, poner al día los flujos de
Maestro y cerrar con la skill cerrar-paquete. Si algo no pasa, se arregla aquí si es pequeño o se
apunta en el ROADMAP con su motivo.

No hagas commit, push, eas update, eas build ni supabase db push: los hooks los bloquean y los
lanzo yo. Tampoco adb uninstall ni maestro cloud. Si al empezar git status trae algo, dímelo antes
de tocar nada. Hay un .txt en docs/ que no se abre, no se lee y no entra en ningún commit.

El ritmo: me enseñas el plan y las decisiones de golpe, cada una con tu recomendación y la
alternativa que descartas. Si contesto «adelante», van como las propones. A partir de ahí solo te
paras en los casos de «Donde sí te paras».

Antes de nada, lee en este orden:
  1. docs/plan/ROADMAP.md, ficha del T-16 y «Cómo se cierra un paquete»
  2. docs/phases/fase-16.md entero
  3. docs/diseno/estado-de-partida.md
  4. docs/guias/prueba-de-cierre-en-dispositivo.md, apartado 4 (TalkBack)
  5. docs/guias/e2e-con-maestro.md y los tres flujos de .maestro/
  6. Las skills cerrar-paquete y probar-en-android

No explores src/ salvo para arreglar lo que salga de la pasada. Para un símbolo, el LSP.

Dónde escribes:
  - src/ solo para lo pequeño que salga de la pasada (una etiqueta, un token, un área táctil)
  - la lista de excepciones del test de diseño: vacía, y el código que la sostenía, fuera
  - .maestro/camino-feliz.yaml y cola-offline.yaml, al día con el PIN y la navegación nueva
  - docs/diseno/estado-final.md (nuevo): la misma tabla que estado-de-partida, con lo de ahora
  - docs/phases/fase-16.md, docs/plan/ROADMAP.md, DESIGN.md («Lo que hoy no cumple»)

Qué no tocas:
  - lo que sea más que un arreglo pequeño: se apunta en el ROADMAP con su motivo
  - domain/, data/, el esquema y las RPC

Decisiones que tienes que tomar:
  1. Qué cuenta como arreglo pequeño: recomiendo menos de un fichero y sin cambiar el diseño.
     Lo demás, al ROADMAP
  2. Si los flujos de Maestro desfasados se rehacen o se borran: recomiendo rehacerlos, con los
     tramos que pide HyperOS. Descartado borrarlos, porque son la única prueba de la cola offline

Casos límite:
  - una pantalla que el script no puede medir (un diálogo del sistema delante): se mide a mano con
    Accessibility Scanner y se dice
  - Supabase en pausa: se reanuda antes de medir; una pantalla medida en error no vale

Reglas que aplican aunque no lo parezca:
  - Regla 1: un arreglo pequeño no toca esquema, RLS, RPC ni lo que decide un ADR aceptado
  - Regla 5: cola-offline.yaml prueba que nada se pierde sin red; tiene que pasar
  - Regla 6: forbidden-claims.test.ts en verde, y revisor-interfaz mira cómo se combinan los textos
    en pantalla
  - Vocabulario: «lista» en la interfaz y en los documentos

Donde sí te paras:
  - si una pantalla tiene un fallo que impide usarla y no es pequeño
  - si cola-offline.yaml encuentra una escritura perdida: eso es la regla 5 y va antes que cerrar

Orden de trabajo:
  1. El plan, y esperas mi OK
  2. La pasada en el POCO con probar-en-android: las 15 pantallas con el script, en claro y oscuro,
     letra al 100 % y al máximo, y TalkBack por la lista, el modo supermercado, gastos y unirse
  3. Los arreglos pequeños y la lista de excepciones vacía. architecture-guard y revisor-interfaz
     sobre lo tocado, uno detrás de otro
  4. Los flujos de Maestro, y npm run test:e2e por tramos en el POCO
  5. docs-drift-auditor sobre DESIGN.md, CLAUDE.md, las skills y los ADR que tocó el paquete
  6. La skill cerrar-paquete, con revisor-documentacion el último

Documentación que cambia:
  - docs/diseno/estado-final.md y fase-16.md: el cierre, con el recuento de controles por debajo de
    cada umbral antes y después
  - DESIGN.md: «Lo que hoy no cumple» vacío o con lo que quede y su motivo
  - ADR-0028: el estado lo cambio yo si se acepta
  - ROADMAP: el T-16 cerrado y «Siguiente» con lo que toque del T-15
  - docs/tecnica/METODO-DE-TRABAJO.md si el script o el test de diseño cambiaron de forma

Terminado cuando:
  - las cinco condiciones de «Cómo se cierra un paquete» del ROADMAP
  - la lista de excepciones del test de diseño vacía
  - el script de inspección sin marcas en las 15 pantallas con la letra al máximo, o cada marca
    explicada en estado-final.md
  - los tres flujos de Maestro pasan en el POCO, por tramos
  - la versión del pie del POCO apuntada en fase-16.md

Al terminar: git status, qué entra en el commit, qué no y por qué, el mensaje en inglés y las
órdenes exactas.
```

## Lo que este prompt da por sentado

- Que los incrementos 3 a 7 están cerrados, cada uno con su prueba en el POCO.
- Que los incrementos 7 y 8 del T-15 no se hicieron antes. Si se hicieron, lo que absorbió el T-16
  ya está en su sitio y el cierre lo comprueba igual.
