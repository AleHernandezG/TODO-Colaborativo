# Preguntas

Las dudas que decide Alejandro. Cada una lleva los hechos, las opciones y una recomendación; la
respuesta va debajo con la fecha y el enlace a dónde acabó. Una pregunta respondida no se borra.
Si la respuesta es «no me convence», se da otra vuelta en la misma pregunta.

El siguiente número libre es **P-05**.

| Pregunta | Sobre qué | Bloquea | Estado |
| --- | --- | --- | --- |
| [P-01](#p-01--el-texto-del-diálogo-de-fin-de-compra) | Texto del diálogo de fin de compra | Nada | Respondida: A |
| [P-02](#p-02--área-táctil-mínima-44-pt-o-48-dp) | Área táctil mínima | Nada | Respondida: A, 48 dp |
| [P-03](#p-03--aceptar-el-adr-0027) | Aceptar el ADR-0027 | Nada | Respondida: aceptado |
| [P-04](#p-04--alcance-y-orden-del-rediseño) | Alcance y orden del rediseño | Nada | Respondida: A con A1 |

---

## P-01 · El texto del diálogo de fin de compra

No bloqueaba nada. El texto nuevo ya estaba en `es.json` y `en.json`.

El test de la regla 6 (`src/shared/lib/i18n/__tests__/forbidden-claims.test.ts`) encontró una
promesa en `shopping.finishDialog.message` el mismo día que se escribió. El diálogo sale al pulsar
«Finalizar compra», también en modo avión, y decía:

- es: «La lista compartida se mantiene actualizada para el resto del grupo.»
- en: «The shared list is up to date for everyone in the group.»

Sin red, los cambios están en la cola y el resto del grupo no los ve hasta que el móvil se
reconecta. Se ha cambiado a:

- es: «El resto del grupo verá los cambios en cuanto tu móvil tenga conexión.»
- en: «The rest of the group will see the changes as soon as your phone is online.»

Opciones:

- **A. Dejar el texto nuevo.** Es cierto con red y sin ella.
- **B. Texto distinto según haya cambios pendientes.** Con la cola vacía, el texto de antes; con
  pendientes, el nuevo. Más exacto, pero toca código de `shopping-mode` y dos claves de i18n.
- **C. Volver al texto original** y quitar la frase del test. Deja la regla 6 con una excepción.

Ningún flujo de `.maestro/` cita el texto viejo (comprobado con `grep`).

**Recomendación: A.** Es una frase y no necesita lógica nueva.

**Respuesta (2026-11-02): A.** Se queda el texto nuevo. El T-16.4, que rehace el modo
supermercado, no lo cambia sin volver a preguntar.

---

## P-02 · Área táctil mínima: 44 pt o 48 dp

Bloqueaba los incrementos 6 y 8 del T-15 y el diseño del T-16 (incremento 2), que fija las
medidas de todas las pantallas. Respondida el 2026-11-02, al final de este apartado.

`CLAUDE.md` pide ≥ 44 × 44 pt, que es la cifra de Apple. Android, que es la plataforma que manda,
recomienda 48 × 48 dp con 8 dp de separación entre controles. En Android 1 pt de React Native es
1 dp, así que la diferencia es real: un botón de 44 dp cumple la regla del repo y no la de la
plataforma. WCAG 2.2 pide 24 × 24 px en AA (2.5.8) y 44 × 44 en AAA (2.5.5).

Opciones:

- **A. Subir la regla a 48 dp** en `CLAUDE.md`, `DESIGN.md` y `revisor-interfaz`, y medir con
  Accessibility Scanner los controles que haya hoy. Algunos crecerán con `hitSlop`, sin cambiar lo
  que se ve.
- **B. Mantener 44 pt** y apuntar que es una decisión consciente.

Fuentes, consultadas el 2026-10-31:

- https://developer.android.com/guide/topics/ui/accessibility/apps
- https://support.google.com/accessibility/android/answer/7101858
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

**Recomendación: A.** Ante una decisión entre plataformas gana Android (`CLAUDE.md`), y con
`hitSlop` el coste en iOS es nulo.

**Respuesta (2026-11-02): A.** La regla pasa a 48 × 48 dp con 8 dp de separación en `CLAUDE.md`,
`DESIGN.md`, `README.md`, la especificación, `architecture-guard`, `revisor-interfaz` y las skills
`expo-stack` y `probar-en-android`. El token `minTouchTarget` (44, usado en unos 50 sitios) y su
test no cambian hoy: es código y mueve todas las pantallas a la vez. Lo sube el T-16.3, que toca
`src/shared/ui`. Hasta entonces el script del T-16.1 falla a 48 y enseña también la columna de 44,
para ver cuánto queda.

---

## P-03 · Aceptar el ADR-0027

No bloqueaba nada: el método ya funcionaba con el ADR en Propuesto.

[ADR-0027](../adr/ADR-0027-metodo-de-trabajo-con-paquetes-y-hooks.md) recoge lo que se montó el
2026-10-31: los paquetes T-NN, los hooks, las skills y los agentes nuevos, y lo que se descartó.
Pasa a Aceptado cuando lo digas.

**Recomendación: aceptarlo tras una o dos sesiones de uso**, cuando se haya visto si algún hook
bloquea de más.

**Respuesta (2026-11-02): aceptado.** Se usó en varias sesiones y ningún hook bloqueó algo que no
debía; el falso positivo que se sospechaba con un grep de «maestro cloud» no existe. Desde hoy el
hook protege el ADR: un cambio al método va en un ADR nuevo.

---

## P-04 · Alcance y orden del rediseño

Bloqueaba el incremento 6 del T-15 (su pantalla del PIN) y la apertura del T-16. Respondida el
2026-11-02, al final de este apartado.

El 2026-11-02, viendo la 1.3.1 en el POCO, pediste rediseñar todas las pantallas. Lo que se midió
ese día (`fase-15.md`, apartado 13):

- La cabecera de la lista lleva cinco botones y deja el título y el selector en 19 px con la letra al
  115 %. El selector solo se abre a ciegas.
- El código de invitación queda a dos deslizamientos, debajo del formulario y del estado vacío.
- Gastos tumba la app en la 1.3.1. No es de diseño, pero es la otra pantalla que no se puede usar.

La app tiene 15 pantallas en `src/app/` (16 ficheros contando `_layout.tsx`).

Alcance:

- **A. Rediseño completo (T-16)**: navegación nueva, una pantalla por incremento, con la prueba en el
  POCO de cada una.
- **B. Solo la cabecera y el selector**, como un incremento más del T-15. Arregla el hallazgo 2 y deja
  el resto como está.

Orden, si es A:

- **A1.** Arreglo de Gastos, después el diseño del T-16 sin código, y después el incremento 6, con la
  pantalla del PIN ya hecha con el diseño nuevo.
- **A2.** Incremento 6 primero, porque cierra la suplantación (ADR-0026), y el rediseño detrás.

**Recomendación: A con A1.** El arreglo de Gastos es pequeño y bloquea una pantalla entera. El diseño
sin código cabe en una sesión y evita hacer dos veces la pantalla del PIN. Con A2, la suplantación
se cierra una o dos sesiones antes, a cambio de rehacer esa pantalla.

**Respuesta (2026-11-02): A con A1.** Rediseño completo en el paquete T-16, en este orden: arreglo de
Gastos ([`prompts/T-15-gastos.md`](prompts/T-15-gastos.md)), herramientas y medición
(T-16.1), diseño sin código (T-16.2), incremento 6 del T-15 con la pantalla del PIN según el diseño
nuevo, y después el resto del T-16. La ficha y los prompts están en el
[ROADMAP](ROADMAP.md#t-16--rediseño-de-las-pantallas) y en `docs/plan/prompts/T-16-*.md`.
