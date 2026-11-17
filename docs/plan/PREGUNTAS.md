# Preguntas

Las dudas que decide Alejandro. Cada una lleva los hechos, las opciones y una recomendación; la
respuesta va debajo con la fecha y el enlace a dónde acabó. Una pregunta respondida no se borra.
Si la respuesta es «no me convence», se da otra vuelta en la misma pregunta.

El siguiente número libre es **P-08**.

| Pregunta | Sobre qué | Bloquea | Estado |
| --- | --- | --- | --- |
| [P-01](#p-01--el-texto-del-diálogo-de-fin-de-compra) | Texto del diálogo de fin de compra | Nada | Respondida: A |
| [P-02](#p-02--área-táctil-mínima-44-pt-o-48-dp) | Área táctil mínima | Nada | Respondida: A, 48 dp |
| [P-03](#p-03--aceptar-el-adr-0027) | Aceptar el ADR-0027 | Nada | Respondida: aceptado |
| [P-04](#p-04--alcance-y-orden-del-rediseño) | Alcance y orden del rediseño | Nada | Respondida: A con A1 |
| [P-05](#p-05--marca-de-pendiente-de-enviar-en-cada-fila) | Marca de «pendiente de enviar» en cada fila | Nada | Respondida: A |
| [P-06](#p-06--restablecer-otra-vez-un-pin-temporal-que-se-perdió) | Restablecer otra vez un PIN temporal perdido | Nada | Abierta |
| [P-07](#p-07--gap-2-da-7-dp-en-android) | `gap-2` da 7 dp en Android | Nada; el T-16.3 decide | Respondida en parte: gap-3 en el T-15.6 |

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

---

## P-05 · Marca de «pendiente de enviar» en cada fila

Bloqueaba solo el aspecto de la fila del T-16.4. Abierta el 2026-11-03 por el hallazgo 3 de
`revisor-interfaz` sobre los bocetos del T-16.2 y respondida el mismo día, al final de este
apartado.

Sin red, la `StatusStrip` dice «Sin conexión. Lo que cambies se enviará al recuperarla.» y un
`Snackbar` avisa de cada mutación encolada. Pero al cerrar el aviso nada dice qué artículo en
concreto está en la cola: quien añade cinco cosas en el sótano del súper y vuelve a tener red no
sabe cuáles han salido. La regla 6 se cumple igual, porque nada dice «guardado».

Lo que hay hoy: la cola de TanStack Query sabe qué mutaciones están en pausa y con qué `variables`,
`id` del artículo incluido (ADR-0009 y ADR-0010). Leerla desde la fila es un `useMutationState`
filtrado por `mutationKey` y por id, sin tocar el servidor ni el esquema.

Opciones:

- **A. Marca en la fila.** Segunda línea en `text-sm muted` con el icono `hourglass_top` y «Se
  enviará al recuperar la conexión», solo en los artículos encolados. TalkBack lo lee como parte
  de la fila. Cuesta un hook en `features/items/presentation` y un test, y la fila pasa de una a
  dos líneas en esos artículos, así que al 200 % cabe uno menos.
- **B. Solo la franja y el aviso**, como ahora. Cero trabajo. Quien quiere saber qué falta no tiene
  dónde mirarlo.
- **C. Contador en la franja**: «Sin conexión. 5 cambios se enviarán al recuperarla.» Un dato más
  sin tocar las filas; dice cuántos, no cuáles.
- **D. A y C juntas.** Lo más claro y lo más caro, y la franja crece al 200 %.

**Recomendación: A.** Es la que contesta la pregunta que se hace la persona («¿esto ha salido?») en
el sitio donde mira, y solo aparece cuando hay algo encolado. C se puede sumar después sin rehacer
nada.

**Respuesta (2026-11-03): A, la marca en la fila.** Lo pinta el T-16.4: el icono `hourglass_top` y
«Se enviará al recuperar la conexión» en la segunda línea de cada artículo con un cambio en la cola,
y TalkBack lo lee con la fila. C queda para más adelante, sin fecha. Está en
[`DESIGN.md`](../../DESIGN.md), apartado «Conexión», y en el prompt
[`T-16-4-lista-y-supermercado.md`](prompts/T-16-4-lista-y-supermercado.md).

## P-06 · Restablecer otra vez un PIN temporal que se perdió

No bloquea el incremento 6 del T-15. Abierta el 2026-11-03 por un hallazgo del cazador de fallos
silenciosos sobre `ResetMemberPinDialog`.

`reset_member_pin` deja la fila con `auth_user_id = null` e `is_admin = false`. El cliente marca
como invitado (`isGuest`) toda fila sin sesión, y `canResetPin` no deja restablecer a un invitado:
tiene sentido para los de RF-12, que nunca tuvieron app ni PIN. El efecto es que, una vez
restablecido, el botón desaparece de esa fila y el admin ya no puede sacar otro PIN temporal desde
la app. Si el temporal se pierde, la persona se queda fuera de su nombre. La salida que queda es
que el admin la quite y vuelva a entrar con el mismo nombre, que queda libre porque la unicidad
solo cuenta a los miembros activos. Pero entra como miembro nuevo y su historial de gastos se
queda con la fila archivada.

Lo que ya está cerrado en este incremento:

- El PIN emitido vive en un store en memoria que rellena el hook. Así sobrevive a que la pantalla
  se desmonte con la petición en vuelo.
- Ante un timeout o un servidor que no responde, el aviso pide pulsar «Restablecer» otra vez sin
  cancelar. El diálogo sigue con la fila de antes y la RPC acepta repetir.

Lo que queda abierto es perderlo de verdad. Puede pasar porque se mata la app antes de apuntarlo o
porque se cancela el diálogo tras un timeout en el que el servidor sí lo restableció. Cuántas veces
pasa no se sabe: no hay ningún restablecimiento hecho todavía, porque la pantalla nace en este
incremento.

En el POCO se perdió uno el 2026-11-03 por una tercera vía: cambiar el tamaño de letra del sistema
con el diálogo abierto. Android recrea la app, que vuelve a la lista con el store en memoria vacío.
Pasa igual al cambiar el tema o al girar el móvil si la orientación no está fijada. Bea se quedó
como invitada y sin botón, y solo se pudo seguir porque era una lista de prueba (`fase-15.md`,
apartado 15).

Opciones:

- **A. Dejar restablecer cualquier fila sin sesión.** Cambia una línea de `canResetPin`. A cambio,
  los invitados de RF-12 también llevan el botón, y darle un PIN a un invitado lo convierte en una
  fila que reclama quien tenga ese PIN. Es un cambio de significado que hoy nadie ha pedido.
- **B. Una RPC de solo lectura para el admin**, del tipo `community_member_pin_states(p_community_id)`,
  que devuelva `member_id` y si la fila tiene PIN, nunca el hash. Así `canResetPin` deja restablecer
  las filas sin sesión que sí tienen PIN, que son las restablecidas, y no los invitados. Cuesta una
  función `security definer` nueva, su comprobación en `test:rls`, el adaptador, un caso de uso y
  su test. Las RPC que ya existen no cambian.
- **C. No hacer nada** y apuntar en la ayuda el camino de quitar y volver a entrar.

**Recomendación: B, en un incremento posterior del T-15, no en la migración B de este.** Arregla lo
que de verdad se pierde sin cambiar qué es un invitado. Tampoco hace crecer la migración que cierra
el agujero de las filas reclamables, que es la urgente.

---

## P-07 · `gap-2` da 7 dp en Android

No bloquea nada. Abierta el 2026-11-03 por una medida de `inspect:screen` en el POCO, durante el
incremento 6 del T-15.

`DESIGN.md` decía «entre dos pulsables hay 8 dp como mínimo, `gap-2`». En nativo NativeWind toma
1 rem = 14, no 16, así que `gap-2` (0,5 rem) son 7 dp. En el POCO, a 440 dpi, eso son 20 px: el
script midió 7,3 dp entre «Copiar el PIN» y «Hecho» en el diálogo del PIN temporal. La foto de
partida ya lo enseñaba sin nombrarlo: 6,9 dp entre «Generar código nuevo» y «Gestionar miembros»
(`docs/diseno/estado-de-partida.md`). Toda la escala sale un 12,5 % más pequeña de lo que dice su
nombre: `p-4` son 14 dp, no 16.

Lo que ya está decidido (respuesta del 2026-11-03): en el T-15.6, `Dialog` y la fila de botones de
`PinReminderCard` pasan a `gap-3` (10,5 dp), y `DESIGN.md` pide `gap-3` entre pulsables. Lo que
queda abierto es el resto de la app.

Opciones:

- **A. `gap-3` entre pulsables en cada pantalla**, según la toque su incremento del T-16. No cambia
  nada que no se esté tocando ya. La escala sigue sin cuadrar con los nombres de Tailwind, y quien
  lea `p-4` seguirá pensando en 16.
- **B. Subir el rem de NativeWind a 16** en la configuración. La escala vuelve a ser la de la web y
  `gap-2` da 8 dp. A cambio, todo el espaciado de todas las pantallas crece un 14 % de golpe, y
  cada pantalla del T-16 que ya se haya medido hay que medirla otra vez. Hay que comprobar con
  context7 cómo se fija en la versión instalada antes de proponerlo como cambio.

**Recomendación: B, al empezar el T-16.3 y antes de pintar ninguna pantalla.** Así se mide todo una
sola vez y la escala dice lo que mide. Si se hace después, cada pantalla ya cerrada se vuelve a
abrir.
