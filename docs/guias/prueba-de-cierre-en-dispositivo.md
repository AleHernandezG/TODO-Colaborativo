# Prueba de cierre en dispositivo (fases 3 y 4)

**Ejecutada el 2026-08-05. Resultado: pasa.** Las dos fases quedan cerradas. Este documento deja
de ser un guion para hacer y pasa a ser el registro de lo que se probó y con qué resultado; se
mantiene entero porque la siguiente entrega grande vuelve a recorrerlo casi igual.

Dos cosas no se comprobaron y ninguna bloquea el cierre, las dos están al final en
[Lo que queda sin ver](#lo-que-queda-sin-ver).

El orden no es caprichoso, está explicado en cada bloque. El detalle de cada paso vive en el
diario de su fase; aquí está la lista y las trampas que solo se ven al montar la prueba.

---

## 0 · Antes de tocar nada

Todo lo pendiente es JavaScript. La Fase 4 no metió ningún módulo nativo (los dos paquetes nuevos
son de TanStack y son JS puro; AsyncStorage y NetInfo ya iban dentro del APK 1.2.0), así que **no
hace falta build nuevo**: un solo update lleva a la vez los arreglos de la Fase 3 y toda la Fase 4.

```powershell
npx eas-cli@latest update --branch preview --message "Fix replaced item photo, tighten UI, add offline cache and queue"
```

- [x] Update publicado
- [x] En **los dos móviles**: cerrar la app del todo (recientes → deslizar) y abrirla
- [x] Al pie de la lista pone `v1.2.0 · <id>`, no `· base`

Si sigue diciendo `· base`, el update no ha llegado y lo que pruebes después no es este código.
Para y averigua por qué.

---

## 1 · Usuario novato (F.1)

**Va primero porque es irreversible.** En cuanto alguien ve la app con otra persona al lado
explicándosela, ya no sirve como novato.

Búscate a alguien que no la haya visto, dale el móvil y dile estas tres cosas sin señalar la
pantalla ni contestar «¿y ahora qué?»:

- [x] «Entra en esta lista con este código: `XXX-XXXX`»
- [x] «Apunta que hay que comprar tres litros de leche»
- [x] «Ya la has comprado, márcalo»

**Las tres sin ayuda.** Ninguno de los tres puntos de fricción que esperaba (elegir entre los dos
botones de la landing, poner cantidad 3, confundir la casilla con el nombre) frenó a la persona lo
bastante como para tener que intervenir. La consecuencia práctica: **el `QuantityStepper` se queda
donde está**, dentro del diálogo de editar. La sospecha de que había que subirlo a la barra de
añadir era eso, una sospecha, y la prueba no la respalda.

Lo que no tenemos es detalle de dónde dudó sin llegar a atascarse, porque no se tomaron notas
durante la sesión. Se pasa el criterio, que es lo que pedía la auditoría; la parte cualitativa se
perdió y no se puede repetir con la misma persona.

**Trampa al montarlo:** no borres los datos de la app para simular a alguien nuevo. Eso crea otro
`auth_user_id` anónimo y el `unique (community_id, username)` te devuelve «ese nombre ya está
cogido». Usa un nombre de usuario distinto, o el segundo móvil.

---

## 2 · Fase 3: lo que arregló la prueba del APK

Con los dos móviles a mano y el panel de Supabase abierto.

### La foto sustituida (el bug de verdad)

- [x] Pon una foto a un artículo. Guarda. Aparece la miniatura
- [x] Vuelve a abrirlo y **sustitúyela por otra distinta**. Guarda. Debe verse **la nueva**
- [x] En el segundo móvil, la miniatura cambia sola en menos de 2 s
- [x] Quita la foto y guarda. Desaparece de la fila al instante
- [x] En Supabase, Storage → `item-images`: el objeto anterior ya no está
- [x] Edita **solo el nombre** de un artículo que tenga foto. La foto no se pierde

El bug que abrió [ADR-0007](../adr/ADR-0007-ruta-versionada-de-las-fotos.md) queda confirmado como
arreglado en dispositivo, que es donde apareció.

### El pie y el diálogo, ya adelgazados

- [x] Ajustes de Android → Pantalla → Tamaño de fuente **al máximo**. Abre la lista: título, barra
      de añadir, código de invitación y botón de salir siguen alcanzables con scroll, nada
      recortado
- [x] Abre el diálogo de editar con la fuente grande: «Hacer foto» y «De la galería» caben en una
      línea y los botones no se salen
- [x] Fuente a normal. Modo oscuro (Ajustes → Pantalla → Tema oscuro). Recorre inicio, crear,
      entrar con código y lista: los bordes de los campos y el de la casilla sin marcar **se ven**,
      no se intuyen
- [x] En modo oscuro, pulsa «Crear la lista» y mira el spinner del botón mientras carga: se ve
      sobre el azul
- [x] Añade un artículo: aparece con un fundido, no de golpe
- [x] Marca uno como comprado: baja a «Comprados» y las filas de debajo se recolocan deslizándose
- [x] Borra el último pendiente teniendo otros comprados: sale «Ya está todo comprado»
- [x] Borra todos: sale el carrito con el título y la instrucción, centrado
- [ ] Ajustes → Accesibilidad → **Quitar animaciones**, y repite añadir y marcar: cambia sin
      animación y sin parpadeos. Déjalo como estaba después

El último no se hizo, ver [Lo que queda sin ver](#lo-que-queda-sin-ver).

---

## 3 · Fase 4: la app sin cobertura

Esto es lo que la fase existe para entregar. Con **un solo móvil** hasta el último paso.

### La lista se ve sin red

- [x] Con red, abre la lista y espera a que carguen artículos **y fotos**
- [x] Cierra la app del todo (recientes → deslizar)
- [x] Modo avión
- [x] Abre la app: entra en la lista **sin espera perceptible** y con los artículos y sus fotos

Si tarda unos 12 s o enseña una pantalla de error, está roto el arranque sin conexión
(incremento 2). Si entra rápido pero la lista sale vacía, está rota la caché (incremento 1).

### Los cambios se encolan y sobreviven al cierre de la app

Sigue en modo avión, desde la lista abierta:

- [x] La cabecera dice «Sin conexión. Estás viendo la última lista guardada»
- [x] Marca **dos artículos** como comprados. Se quedan marcados, sin ningún error, y el aviso pasa
      a «2 cambios se guardarán al recuperarla»
- [x] Añade un artículo nuevo. Aparece arriba y el contador sube a 3
- [x] Borra un artículo. Sale el snackbar con «Deshacer»; **no lo toques**. A los 5 s el contador
      sube a 4
- [x] Cierra la app del todo. Sigue en modo avión
- [x] Ábrela otra vez: entra directa a la lista, con los dos marcados, el nuevo puesto, el borrado
      ausente, y el aviso de **4 cambios pendientes**
- [x] Quita el modo avión sin tocar nada más. En unos segundos el aviso desaparece y la lista se
      queda igual
- [x] **En el segundo móvil**: los cuatro cambios están

Ningún fantasma en el paso del cierre: lo que se veía tras reabrir en avión es lo mismo que quedó
al recuperar la red, que es el fallo concreto que el incremento 4 existe para evitar.

> Esto se arregló después, el mismo 2026-08-05, en el incremento 1 de la Fase 5: el guion de abajo
> ya no es «no lo hagas» sino la prueba a pasar, y está escrito en `docs/phases/fase-5.md`. Lo de
> abajo se queda como estaba porque describe lo que se probó ese día, con el código de entonces.

**No hagas esto, que ya sé que falla:** añadir un artículo sin cobertura y, sin recuperar la red,
marcarlo como comprado. El alta llega bien al reconectar, pero la marca viaja con un id inventado
que el servidor no conoce y se pierde sin avisar. Es deuda conocida y está anotada en
[`fase-4.md`](../phases/fase-4.md) con su arreglo, que es de la Fase 5. Si lo pruebas, no es una
regresión nueva.

---

## 4 · TalkBack, en una pasada aparte

**Aplazado por decisión del usuario el 2026-08-05: no se considera necesario para esta beta y se
hará al final, antes de publicar.** Deja de bloquear el cierre de la Fase 3; sigue siendo criterio
de F.2 y está anotado como deuda abierta en [`fase-3.md`](../phases/fase-3.md).

Lo que hay que recorrer cuando toque:

- [ ] Al enfocar una fila: lee el nombre y la cantidad, y ofrece la casilla como control separado
- [ ] En una fila **con foto**: lee «Leche, cantidad 3, botón» y pasa directo al botón de borrar,
      sin pararse en la miniatura
- [ ] Los botones «Copiar» y «Compartir» se anuncian con su nombre y su pista
- [ ] El código de invitación se deletrea (`P A N - 4 2 X K`), no se lee del tirón
- [ ] En el diálogo de editar: «Hacer foto» y «De la galería» se anuncian con su hint, que es donde
      vive ahora la explicación larga
- [ ] Los botones del diálogo siguen midiendo 44 pt (pasaron a `size="sm"`, que baja el padding
      pero mantiene el `minHeight`)
- [ ] Marca el último artículo pendiente: anuncia «Ya está todo comprado» solo, sin buscarlo

Lo automático de F.2 (contraste, áreas táctiles, presencia de labels) sí está cumplido y lo
comprueban los tests. Lo que falta es lo único que un test no ve: que lo que se lee en voz alta
tenga sentido y en el orden bueno.

---

## 5 · Opcional: los E2E

No es criterio de cierre y no se ejecutaron. Si quieres montarlos, hace falta el CLI de Maestro,
`adb` y el APK instalado: [`e2e-con-maestro.md`](e2e-con-maestro.md). Los dos flujos están escritos
pero nunca se han ejecutado, así que la primera pasada puede pedir ajustes de tiempos de espera.

---

## Lo que queda sin ver

Dos huecos. Ninguno bloquea la beta y los dos están anotados donde toca para que no se pierdan.

**«Quitar animaciones» de Android.** No se probó porque el ajuste no se encontró: está en
**Ajustes → Accesibilidad → Quitar animaciones** en Android 12+, y en algunos fabricantes cuelga de
un submenú («Color y movimiento» en Pixel, «Mejoras de visibilidad» en Samsung). Si no aparece, el
equivalente es Opciones de desarrollador → las tres escalas de animación a «Desactivada».

Riesgo bajo: no hay código nuestro implicado. Reanimated respeta `ReduceMotion.System` por defecto,
así que quien tenga el ajuste puesto no ve `FadeIn` ni `LinearTransition` sin que haya que
programar nada. Lo que la prueba habría confirmado es que al saltarse la animación no quede un
parpadeo, y eso es cosa de la librería, no de la app.

**TalkBack.** Aplazado a propósito, ver el bloque 4.

---

## Qué se cerró con esto

- **Fase 3:** cerrada. Bloques 1 y 2 en verde. F.1 superado, F.2 con lo automático cumplido y la
  pasada de TalkBack aplazada por decisión.
- **Fase 4:** cerrada. Bloque 3 en verde, incluido el reinicio con la cola llena, que era el paso
  que de verdad decidía la fase.
