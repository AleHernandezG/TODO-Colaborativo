# Diseño

Cómo se ve esta app y por qué. Es lo que hay que leer antes de pintar una pantalla nueva o de tocar
el aspecto de una que ya existe.

Los valores salen de `src/theme/tokens.js`, que es la única fuente de verdad: Tailwind los lee desde
`tailwind.config.js` y el código desde `@/theme`. Si este documento y los tokens dicen cosas
distintas, mandan los tokens y este fichero está desfasado. Los tamaños de letra y la escala de
espaciado son los de Tailwind por defecto, sin tocar.

Cada pantalla está dibujada en claro, en oscuro y con la letra al 200 % en
[`docs/diseno/bocetos.html`](docs/diseno/bocetos.html), del T-16.2. La navegación la decide
[ADR-0028](docs/adr/ADR-0028-navegacion-por-pestanas.md). Las reglas de movimiento y de pulido con su
código están en la skill `expo-stack`, sección «Pulido visual y movimiento». Aquí está el qué; allí,
el cómo.

## Carácter

Una lista de la compra que se usa de pie, con una mano y con prisa, por gente que no tiene por qué
manejarse bien con el móvil. De ahí sale todo lo demás:

- Plana y tranquila. Las superficies se distinguen por color de fondo y por borde, no por sombras.
- Texto grande. El nombre de un artículo va en `text-lg`, no en el tamaño de cuerpo.
- Un solo color de acento, el azul de `primary`, y solo para lo que se puede pulsar o está activo.
- Una acción principal por pantalla, la única con relleno `primary`. En la Lista es «Añadir», junto
  al campo fijo de arriba; en el resto va abajo, a todo el ancho, en la `ActionBar`.
- La app hace dos cosas, la lista y los gastos. Recetas y Menú están escondidos (ADR-0028).
- Nada decorativo: ni degradados, ni ilustraciones, ni tarjetas dentro de tarjetas.

## Color

Cada color tiene un papel. Se usa por su clase de Tailwind, siempre con su pareja `dark:`.

| Papel                        | Clase                | Claro     | Oscuro    |
| ---------------------------- | -------------------- | --------- | --------- |
| Fondo de pantalla            | `bg-background`      | `#FFFFFF` | `#0B0F19` |
| Fila, tarjeta, campo         | `bg-surface`         | `#F3F4F6` | `#161B26` |
| Texto principal              | `text-content`       | `#111827` | `#F3F4F6` |
| Texto secundario             | `text-muted`         | `#4B5563` | `#9CA3AF` |
| Separador y borde de tarjeta | `border-line`        | `#D1D5DB` | `#2A3140` |
| Borde de un control          | `border-line-strong` | `#6B7280` | `#6B7280` |
| Acción y estado activo       | `bg-primary`         | `#1D4ED8` | `#60A5FA` |
| Texto sobre `primary`        | `text-on-primary`    | `#FFFFFF` | `#0B0F19` |
| Borrar y errores             | `text-danger`        | `#B91C1C` | `#F87171` |
| Confirmación                 | `text-success`       | `#15803D` | `#4ADE80` |

Cosas que no se deducen de la tabla:

- **Lo que va sobre `primary` es `on-primary`, siempre.** En oscuro `primary` es un azul claro y el
  blanco fijo encima se queda en 2,5:1; `#0B0F19` da 7,5:1. Era el fallo 23 de la foto de partida.
- `line` no llega al 3:1 contra el fondo, así que sirve para separar pero no para dibujar el contorno
  de algo que se pulsa. El borde de un checkbox, un campo o un botón secundario es `line-strong`, y
  también el de una tarjeta que pide algo, como «Ponte un PIN».
- `primary` va en lo que se pulsa o está activo, y en el relleno de la barra de progreso del modo
  supermercado, que dice cuánto llevas comprado.
- `danger` y `success` son colores de texto y de borde. No hay fondo rojo ni verde: el botón de
  borrar es una superficie con borde y texto `danger`.
- El contraste lo comprueba `src/theme/__tests__/tokens.test.ts` (4.5:1 para texto, 3:1 para
  controles, en los dos esquemas). Un color nuevo entra en `tokens.js` con su par añadido a ese test.
- Ningún hexadecimal en un componente. Si hace falta el valor en JS, como el color de un
  `ActivityIndicator` o de la barra de pestañas, se pide con `usePalette()`.

## Tipografía

La fuente es la del sistema, sin cargar ninguna. Cada tamaño tiene un uso:

| Clase       | Para qué                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| `text-4xl`  | Título de la bienvenida, el código de invitación, el importe de un gasto, el PIN temporal                            |
| `text-3xl`  | La cifra que se escribe o se resume: el importe de Nuevo gasto, tu saldo                                             |
| `text-xl`   | Título de la cabecera, título de un diálogo, encabezado de bloque                                                    |
| `text-lg`   | Lo que se lee de un vistazo: nombre en una fila, etiqueta de botón, título de tarjeta, pasillo del modo supermercado |
| `text-base` | Cuerpo, campos, chips, encabezado de grupo de una lista, botón pequeño en una fila                                   |
| `text-sm`   | Apoyo: la segunda línea de una fila, la ayuda de un campo, la franja de conexión, la etiqueta de pestaña             |
| `text-xs`   | Solo el pie con la versión                                                                                           |

`text-2xl` no tiene uso. Quien lo necesite lo añade antes a esta tabla.

Pesos: `font-medium` para datos que acompañan (una cantidad), `font-semibold` para etiquetas de
botón y de campo, `font-bold` para títulos y cifras. El cuerpo va sin peso.

El tamaño de fuente del sistema se respeta: ningún `allowFontScaling={false}` y ninguna altura fija
en un contenedor con texto, que se usa `minHeight`. Un texto que no cabe baja de línea; solo el
título de la cabecera se corta, a dos líneas (ver «Cabecera»).

La etiqueta de las pestañas la pinta Android. Se le pasa `tabLabelSize` de `@/theme` para que no
salga en los 12 sp que trae por defecto.

Las cifras que cambian o que se comparan en columna (importes, cantidades, contadores) van con
números tabulares para que no bailen al actualizarse: `style={tabularNums}`, de `@/theme`. NativeWind
no tiene clase para esto. Una cifra nunca va pegada a su etiqueta en la misma línea: la etiqueta
encima, en `text-sm muted`, y la cifra debajo.

## Forma

Tres radios y `full`, en `tokens.js`:

| Clase          | Valor | Para qué                                         |
| -------------- | ----- | ------------------------------------------------ |
| `rounded-sm`   | 6     | Lo que va dentro de un control: miniatura        |
| `rounded-md`   | 10    | Controles y filas: botón, campo, checkbox, aviso |
| `rounded-lg`   | 16    | Contenedores: tarjeta, diálogo                   |
| `rounded-full` |       | Chips, avatares, barra de progreso, `IconButton` |

Cuando un elemento redondeado va pegado al borde de otro, el radio de dentro es el de fuera menos el
padding que los separa. Una tarjeta `rounded-lg` con `p-2` lleva dentro piezas `rounded-sm`, no otra
vez `rounded-lg`.

## Espaciado y tamaños

Escala de Tailwind, en múltiplos de 4. Lo habitual: `gap-2` entre elementos de una fila, `gap-3`
entre filas o bloques, `p-4` de relleno de tarjeta, `px-4` de margen lateral de pantalla. Los medios
pasos (`0.5`, `1.5`) solo para ajustar un chip o una insignia.

| Token de `@/theme`      | Valor       | Para qué                                                  |
| ----------------------- | ----------- | --------------------------------------------------------- |
| `minTouchTarget`        | 48 (hoy 44) | Alto y ancho mínimos de todo lo que se pulsa              |
| `rowMinHeight.default`  | 56          | Fila de lista, de miembros, de gastos y opción de diálogo |
| `rowMinHeight.shopping` | 64          | Fila del modo supermercado (RF-16 pide al menos 60)       |
| `iconSize`              | 24          | Todos los iconos. No crece con la letra                   |

`minTouchTarget` está todavía en 44 y lo sube el T-16.3 (P-02). `iconSize`, `rowMinHeight` y
`tabLabelSize` ya están en `tokens.js`, y el T-16.3 los exporta desde `@/theme`. Entre dos
pulsables hay 8 dp como mínimo, `gap-2`. Si el dibujo es más pequeño que 48, crece el área con `hitSlop`, no el dibujo.

## Navegación

Dos pestañas en la barra nativa de Android: **Lista** y **Gastos** (ADR-0028). Lista es la de
entrada; atrás desde Gastos vuelve a Lista y desde Lista sale de la app.

Todo lo demás se abre encima, sin barra, con su `ScreenHeader`: modo supermercado, Miembros, Tu PIN,
Nuevo gasto, Todos los gastos y Gasto. Bienvenida, Crear y Unirse van sin barra porque todavía no hay
lista.

Cómo se llega a cada cosa, en toques desde una pestaña:

| Destino                         | Desde                                      | Toques |
| ------------------------------- | ------------------------------------------ | ------ |
| Miembros y código de invitación | Icono de la cabecera, en las dos pestañas  | 1      |
| PDF de la lista                 | Icono de la cabecera, solo en Lista        | 1      |
| Modo supermercado               | «Ir a comprar», en la `ActionBar` de Lista | 1      |
| Otra lista, crear o unirse      | El título de la cabecera abre el selector  | 2      |
| Tu PIN                          | Miembros, en tu fila                       | 2      |
| Opciones de un miembro          | Miembros, el control de su fila            | 2      |
| Nuevo gasto y Todos los gastos  | Gastos                                     | 1      |
| Un gasto                        | Gastos, su fila; uno antiguo, desde Todos  | 1 o 2  |
| Editar un artículo              | Lista, la fila fuera del checkbox          | 1      |

«Toques» es lo que cuesta llegar a la pantalla o al diálogo, no terminar lo que se hace en él.

Cambiar de lista no navega: quien está en Gastos sigue en Gastos de la otra lista.

La barra usa los tokens: fondo `surface`, indicador `primary` y el icono activo en `on-primary`. El
alto y el indicador los dibuja Android. Con dos pestañas cada etiqueta tiene unos 196 dp y cabe al
200 %; si en un móvil se cortara, ADR-0028 dice cómo se cambia a la barra en JS.

## Cabecera

Hay dos, las dos en `src/shared/ui` y sin la cabecera nativa del `Stack`, que tiene alto fijo.

`AppHeader`, en las pestañas. El título es el selector de listas (ADR-0025): el nombre de la lista
en `text-xl font-bold` con su flecha, el mismo en Lista y en Gastos. A la derecha van dos
`IconButton` como mucho, Miembros siempre y el PDF solo en Lista. El título ocupa lo que dejan los
iconos y baja a dos líneas; a partir de ahí, elipsis. TalkBack lee el nombre entero y el selector lo
enseña sin cortar.

`ScreenHeader`, en lo que se abre encima. Atrás a la izquierda, que se anuncia «Volver» y nunca
«Cancelar», el título en `text-xl font-bold` a dos líneas y, si hace falta, un `IconButton` a la
derecha (Editar). **Guardar nunca va en la cabecera**: va en la `ActionBar`. Era lo que se caía de
la pantalla con la letra grande. El modo supermercado usa una cruz en vez de la flecha y se anuncia
«Salir del modo supermercado».

Ninguna cabecera lleva texto junto al título fuera de este: un botón con texto es lo primero que
deja de caber al 200 %.

## Componentes

Lo que se pinta sale de `src/shared/ui`. Una pantalla no dibuja su propio botón, fila o cabecera.

| Componente                                                                          | Qué es                                                                                                | Lo crea |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------- |
| `AppHeader`                                                                         | Cabecera de las pestañas, arriba                                                                      | T-16.3  |
| `ScreenHeader`                                                                      | Cabecera de lo que se abre encima                                                                     | T-15.6  |
| `ActionBar`                                                                         | La acción principal abajo, a todo el ancho, separada por `border-line`. Sube con el teclado           | T-15.6  |
| `StatusStrip`                                                                       | La franja de conexión bajo la cabecera. Sustituye a `OfflineBanner` y `RealtimeStatus`                | T-16.3  |
| `Icon`                                                                              | Un icono de Material Symbols, por `expo-symbols`, a `iconSize`                                        | T-16.3  |
| `IconButton`                                                                        | Un `Icon` en un área de 48 × 48, `rounded-full`, con `accessibilityLabel` obligatorio                 | T-16.3  |
| `ListRow`                                                                           | Fila de `rowMinHeight`, con hueco a la izquierda, dos líneas y hueco a la derecha                     | T-16.4  |
| `EmptyState`                                                                        | Una frase que dice qué hacer y una acción debajo                                                      | T-16.4  |
| `ErrorState`                                                                        | Lo mismo para un fallo de carga, con el código entre paréntesis                                       | T-16.4  |
| `Button`                                                                            | Primario (`primary`), secundario (borde `line-strong`), de borrar (borde y texto `danger`) y de texto | ya está |
| `Input`                                                                             | Etiqueta encima, campo de 48, ayuda o error debajo                                                    | ya está |
| `Checkbox`, `QuantityStepper`, `Dialog`, `PickerDialog`, `SnackbarHost`, `BuildTag` | Sin cambios de papel                                                                                  | ya está |

`ScreenHeader` y `ActionBar` los crea el incremento 6 del T-15, que pinta la pantalla del PIN antes
del T-16.3. El campo del PIN no va aquí: vive en `features/community`.

Las filas siguen el mismo orden siempre: lo que se marca o la inicial, la foto si la hay, el nombre
en `text-lg` con su segunda línea en `text-sm muted`, y a la derecha la cantidad, la cifra o un
único control. **Una fila tiene un solo control a la derecha.** Cuando hay varias acciones sobre la
misma persona o cosa, el control es «Opciones de Bea» y abre un `Dialog` con cada una, la de borrar
separada del resto y en `danger`.

En la Lista el control de la izquierda es el checkbox y el resto de la fila abre `EditItemDialog`,
donde están el nombre, Cantidad, Unidad, la foto y Borrar. La fila no lleva botones de cantidad: se
cambia ahí. El diálogo lo dibuja el T-16.4 y espera OK antes de escribirlo.

Un diálogo cuyo contenido no cabe hace scroll por dentro, con sus botones siempre a la vista. En
una pantalla, el contenido hace scroll y la `ActionBar` se queda fija.

## Teclado

- Ninguna pantalla abre el teclado al entrar. La excepción es la que solo sirve para escribir una
  cosa, como Tu PIN.
- El campo de añadir de la Lista va fijo arriba, bajo la cabecera, para que el teclado no lo tape.
  Las sugerencias del catálogo salen debajo del campo, con su precio orientativo y la línea
  «Precios de Mercadona, orientativos». Si un dato viene de Open Food Facts, su atribución va
  visible en la pantalla que lo enseña.
- La `ActionBar` sube con el teclado, así que Guardar siempre se ve. «Ir a comprar» se esconde
  mientras se escribe.
- La barra de pestañas queda debajo del teclado, como hace Android por defecto.
- El teclado es el que pide el dato: numérico para un importe o un PIN.

## Conexión

La caché se pinta enseguida, sin spinner, y los botones siguen activos. Lo que se cambia sin red se
encola (ADR-0009). La `StatusStrip` va bajo la cabecera, en las dos pestañas y en lo que se abre
encima, empuja el contenido en vez de taparlo y es región viva para TalkBack. Siempre en el mismo
sitio:

| Cuándo                                 | Qué dice                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| Sin red                                | «Sin conexión. Lo que cambies se enviará al recuperarla.»                          |
| Pasados 2 s sin respuesta del servidor | «Comprobando la conexión. Puedes seguir: lo que cambies se enviará cuando llegue.» |
| A los ~12 s, servidor inalcanzable     | «No se llega al servidor. Lo que cambies se enviará cuando responda.» y el código  |

Nada de esto dice «guardado», «sincronizado» ni «al día» (regla 6), y el aviso de una mutación
encolada tampoco: «Leche entera: se enviará al recuperar la conexión». El tiempo de espera de las
peticiones no lo cambia el diseño.

Lo que no se puede encolar, como crear una lista o cambiar el PIN, deja el botón en carga con su
verbo («Creando la lista…») y a los 3 s dice qué espera: «Esperando al servidor…». El éxito se dice
solo cuando el servidor lo confirma.

Sin red, el código de invitación se enseña el que está en caché con «Puede haber cambiado» al lado,
porque otro miembro lo puede haber rotado (ADR-0011). La presencia («Viendo la lista ahora») se
esconde: sin red no se sabe quién mira.

Si un artículo encolado lleva una marca propia en su fila, «pendiente de enviar», está por decidir
en [P-05](docs/plan/PREGUNTAS.md#p-05--marca-de-pendiente-de-enviar-en-cada-fila). Mientras tanto
lo dice solo la franja.

## Estados

- **Pulsado.** Baja la opacidad: `active:opacity-70` en filas, iconos y controles sin relleno,
  `active:opacity-80` en botones con relleno.
- **Deshabilitado o cargando.** `opacity-50`, sin estado pulsado, y `accessibilityState` al día.
- **Comprado.** Tachado, texto `muted` y checkbox relleno con su marca. Nunca solo el color. Los
  comprados se pliegan al final bajo «Comprados (n)».
- **Seleccionado.** Un chip seleccionado lleva fondo `primary`, texto `on-primary` y una marca
  `check` delante, para que no dependa del color. En la barra de pestañas el icono activo va en
  `on-primary` sobre el indicador y la etiqueta en `content`. Las dos con `accessibilityState`
  `selected`.
- **Error.** Texto `danger` con el mensaje y el código entre paréntesis. El de un campo, debajo de
  ese campo; el de una carga, con `ErrorState`.
- **Vacío.** `EmptyState`. En la Lista dice «Escribe arriba lo que hace falta.», con «Invitar a
  alguien» debajo, y el campo de añadir sigue arriba.
- **Presencia.** En texto («Viendo la lista ahora»), no como un punto de color.

Qué estados tiene cada pantalla y cuáles están ya dibujados en los bocetos. «Inc.» marca lo que
dibuja el incremento de esa pantalla antes de escribirlo, y espera OK:

| Pantalla                  | Con datos   | Vacía       | Cargando sin caché | Error de carga | Sin red     | Al 200 %    |
| ------------------------- | ----------- | ----------- | ------------------ | -------------- | ----------- | ----------- |
| Lista                     | Boceto      | Boceto      | Inc. T-16.4        | Inc. T-16.4    | Boceto      | Boceto      |
| Modo supermercado         | Boceto      | Inc. T-16.4 | Inc. T-16.4        | Inc. T-16.4    | Boceto      | Boceto      |
| Gastos                    | Boceto      | Boceto      | Inc. T-16.5        | Inc. T-16.5    | Inc. T-16.5 | Boceto      |
| Nuevo gasto               | Boceto      | No aplica   | No aplica          | Inc. T-16.5    | Inc. T-16.5 | Boceto      |
| Todos los gastos y Gasto  | Inc. T-16.5 | Inc. T-16.5 | Inc. T-16.5        | Inc. T-16.5    | Inc. T-16.5 | Inc. T-16.5 |
| Miembros                  | Boceto      | No aplica   | Inc. T-16.5        | Inc. T-16.5    | Boceto      | Boceto      |
| Tu PIN                    | Boceto      | No aplica   | No aplica          | Boceto         | Boceto      | Boceto      |
| Bienvenida, Crear, Unirse | Boceto      | No aplica   | No aplica          | Inc. T-16.6    | Inc. T-16.6 | Boceto      |

Los diálogos al 200 % (`EditItemDialog`, Opciones de un miembro, el PIN temporal) también los dibuja
cada incremento.

## Iconos

Material Symbols, por `expo-symbols` con el nombre de Android (`md`), siempre a `iconSize` y del
color del texto que los rodea o del papel que tengan (`danger` en borrar). En Android salen de una
fuente que ya está en el árbol, sin código nativo (ADR-0028). Los que usa la app:

| Uso                    | Nombre           |
| ---------------------- | ---------------- |
| Pestaña Lista          | `checklist`      |
| Pestaña Gastos         | `payments`       |
| Miembros               | `group`          |
| PDF                    | `picture_as_pdf` |
| Volver                 | `arrow_back`     |
| Salir del supermercado | `close`          |
| Selector de listas     | `expand_more`    |
| Añadir                 | `add`            |
| Opciones de una fila   | `more_vert`      |
| Ir a comprar           | `shopping_cart`  |
| Sin conexión           | `cloud_off`      |
| Comprobando            | `sync`           |
| Servidor inalcanzable  | `error`          |
| Copiar                 | `content_copy`   |
| Compartir              | `share`          |
| Borrar                 | `delete`         |
| Editar                 | `edit`           |
| Invitar a alguien      | `person_add`     |
| Unirme con un código   | `key`            |
| Tu PIN                 | `pin`            |
| Rotar el código        | `refresh`        |
| Todos los gastos       | `history`        |
| Administrador          | `shield_person`  |
| Restablecer un PIN     | `lock_reset`     |
| Quitar a un miembro    | `person_remove`  |
| Esperando al servidor  | `hourglass_top`  |
| Seleccionado, comprado | `check`          |
| Plegar comprados       | `expand_less`    |
| Un gasto               | `receipt_long`   |
| Una liquidación        | `sync_alt`       |

Un icono nuevo entra en esta tabla. Los glifos que hay en las miniaturas de los bocetos ocupan el
sitio de una foto y no son iconos de la app. Un icono solo nunca es la única pista de un estado,
y un botón de solo icono lleva `accessibilityLabel` con el sujeto: «Opciones de Bea», no «Opciones». Los glifos
de texto (`✕`, `✓`, `×`) y los emoji dejan de usarse como iconos; `×2` en una cantidad es texto y
se queda.

## TalkBack

El orden es el de lectura, de arriba abajo y de inicio a fin, y la cabecera y la barra son grupos.
En la Lista:

1. El título: «Casa, lista actual. Cambiar de lista».
2. «Miembros y código de invitación» y «Compartir la lista en PDF».
3. La `StatusStrip`, si está.
4. El campo de añadir y su botón, «Añadir a la lista».
5. Cada artículo en una sola parada: «Leche entera, cantidad 2, pendiente». Activarla marca o
   desmarca el artículo; Editar y Borrar van como acciones personalizadas
   (`accessibilityActions`), que TalkBack ofrece en su menú.
6. «Comprados, 4, plegado».
7. «Ir a comprar».
8. La barra nativa: «Lista, pestaña 1 de 2, seleccionada».

El resto de pantallas sigue el mismo principio: cabecera, franja, contenido en orden de lectura,
`ActionBar` y barra. Una fila es una parada, con su acción principal al activarla y lo demás como
acciones personalizadas.

Cada etiqueta dice a quién afecta («Saldar con Bea, 12,00 €», «Quitar a Bea de la lista»,
«Repartir con Bea», «Compartir el código de Casa») y ninguna lleva la palabra «botón», que ya la
pone el rol.

## Letra al 200 %

Lo que se dibujó al 200 % en los bocetos y lo que manda cuando no cabe:

- Los iconos y su área no crecen. Crecen el texto y el alto de las filas.
- El título de la cabecera baja a dos líneas y luego se corta. Ningún otro texto que pintemos
  nosotros se corta; la etiqueta de la barra nativa la pinta Android y es la excepción (ADR-0028).
- El código de invitación nunca se parte por la mitad de un grupo: si no cabe en una línea, cada
  grupo va en la suya.
- El contenido hace scroll y la `ActionBar` se queda fija abajo.
- Los chips, los botones de una tarjeta y los campos Cantidad y Unidad bajan a otra línea.
- La inicial de un avatar crece con la letra: el círculo es un mínimo, no un tamaño fijo.
- En la Lista con la franja encendida quedan a la vista poco más de un artículo. El T-16.3 lo mide
  en el POCO; si no caben dos, «Ir a comprar» deja la `ActionBar` y pasa a ser la última fila de la
  lista.

## Movimiento

Poco y corto. Una fila que aparece o se recoloca tarda 180 ms. Lo que el usuario hace decenas de
veces en una compra, como marcar un artículo, cambia al instante. Cambiar de pestaña no se anima. El
detalle está en la skill.

## Lo que no se hace

- Sombras para dar relieve a una tarjeta. Lo único que flota son `Dialog` y `Snackbar` de Paper,
  que traen su propia elevación y viven en `src/shared/ui`.
- Un segundo color de acento, o `primary` en algo que no se pulsa ni está activo.
- Blanco fijo, o cualquier color que no sea `on-primary`, sobre `primary`.
- Texto `muted` sobre `primary` o sobre cualquier fondo saturado.
- Tarjeta dentro de tarjeta.
- Guardar o cualquier botón con texto en la cabecera.
- Dos controles a la derecha de una misma fila.
- Animar la entrada de una pantalla entera o de una lista al cargar.
- Un menú lateral o un menú de desbordamiento: el `Menu` de Paper no está permitido (ADR-0004).
- Un radio, un tamaño, un color o un icono que no esté en las tablas de arriba.
- Componentes de Paper fuera de `Snackbar`, `Dialog` y `Portal`.

## Lo que hoy no cumple

La lista ya no se lleva a mano aquí. Desde el T-16.1 la lleva
`src/shared/lib/__tests__/design-rules-exceptions.json`, con fichero, regla, número de líneas y
motivo, y `design-rules.test.ts` falla si una línea nueva se sale de los tokens o si se arregla una
sin bajar el número. Cada incremento del T-16 quita las de sus pantallas y el T-16.7 cierra con las
de las pantallas que se ven a cero.

Siete entradas (20 líneas) son de `features/recipes` y `features/meal-planner`, que ya no tienen
pantalla (ADR-0028). Se quedan en la lista con ese motivo: arreglarlas es trabajo sobre algo que no
se ve.

Lo que se ve en el móvil (pulsables pequeños, textos aplastados con la letra grande) no lo caza un
test: está medido pantalla a pantalla en `docs/diseno/estado-de-partida.md`.
