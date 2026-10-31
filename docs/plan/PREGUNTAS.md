# Preguntas

Las dudas que decide Alejandro. Cada una lleva los hechos, las opciones y una recomendación; la
respuesta va debajo con la fecha y el enlace a dónde acabó. Una pregunta respondida no se borra.
Si la respuesta es «no me convence», se da otra vuelta en la misma pregunta.

El siguiente número libre es **P-04**.

| Pregunta | Sobre qué | Bloquea | Estado |
| --- | --- | --- | --- |
| [P-01](#p-01--el-texto-del-diálogo-de-fin-de-compra) | Texto del diálogo de fin de compra | Nada | Abierta |
| [P-02](#p-02--área-táctil-mínima-44-pt-o-48-dp) | Área táctil mínima | Incrementos 6 y 8 del T-15 | Abierta |
| [P-03](#p-03--aceptar-el-adr-0027) | Aceptar el ADR-0027 | Nada | Abierta |

---

## P-01 · El texto del diálogo de fin de compra

**No bloquea nada; ya está cambiado en el árbol, sin commit.**

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

---

## P-02 · Área táctil mínima: 44 pt o 48 dp

**Bloquea los incrementos 6 y 8 del T-15**, que tocan pantallas y accesibilidad.

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

---

## P-03 · Aceptar el ADR-0027

**No bloquea nada**: el método ya funciona mientras el ADR está en Propuesto.

[ADR-0027](../adr/ADR-0027-metodo-de-trabajo-con-paquetes-y-hooks.md) recoge lo que se montó el
2026-10-31: los paquetes T-NN, los hooks, las skills y los agentes nuevos, y lo que se descartó.
Pasa a Aceptado cuando lo digas.

**Recomendación: aceptarlo tras una o dos sesiones de uso**, cuando se haya visto si algún hook
bloquea de más.
