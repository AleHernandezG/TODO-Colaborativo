# Diseño

Cómo se ve esta app y por qué. Es lo que hay que leer antes de pintar una pantalla nueva o de tocar
el aspecto de una que ya existe.

Los valores salen de `src/theme/tokens.js`, que es la única fuente de verdad: Tailwind los lee desde
`tailwind.config.js` y el código desde `@/theme`. Si este documento y los tokens dicen cosas
distintas, mandan los tokens y este fichero está desfasado.

Las reglas de movimiento y de pulido con su código están en la skill `expo-stack`, sección "Pulido
visual y movimiento". Aquí está el qué; allí, el cómo.

## Carácter

Una lista de la compra que se usa de pie, con una mano y con prisa, por gente que no tiene por qué
manejarse bien con el móvil. De ahí sale todo lo demás:

- Plana y tranquila. Las superficies se distinguen por color de fondo y por borde, no por sombras.
- Texto grande. El nombre de un artículo va en `text-lg`, no en el tamaño de cuerpo.
- Un solo color de acento, el azul de `primary`, y solo para lo que se puede pulsar o está activo.
- Una acción principal por pantalla, a todo el ancho.
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

- `line` no llega al 3:1 contra el fondo, así que sirve para separar pero no para dibujar el contorno
  de algo que se pulsa. El borde de un checkbox o de un campo vacío es `line-strong`.
- `danger` y `success` son colores de texto y de borde. No hay fondo rojo ni verde: el botón de
  borrar es una superficie con borde y texto `danger`.
- El contraste lo comprueba `src/theme/__tests__/tokens.test.ts` (4.5:1 para texto, 3:1 para
  controles, en los dos esquemas). Un color nuevo entra en `tokens.js` con su par añadido a ese test.
- Ningún hexadecimal en un componente. Si hace falta el valor en JS, como el color de un
  `ActivityIndicator`, se pide con `usePalette()`.

## Tipografía

La fuente es la del sistema, sin cargar ninguna. Los tamaños son los de Tailwind y cada uno tiene un
uso:

| Clase                   | Para qué                                                     |
| ----------------------- | ------------------------------------------------------------ |
| `text-4xl` / `text-3xl` | Título de las pantallas de entrada y cifras protagonistas    |
| `text-2xl`              | Título de pantalla                                           |
| `text-xl`               | Cabecera de sección                                          |
| `text-lg`               | Lo que se lee de un vistazo: nombre del artículo, botón `md` |
| `text-base`             | Cuerpo, campos, botón `sm`                                   |
| `text-sm`               | Texto de apoyo bajo un título o un campo                     |
| `text-xs`               | Metadatos: fechas, contadores, etiquetas de chip             |

Pesos: `font-medium` para datos que acompañan (una cantidad), `font-semibold` para etiquetas de
botón y títulos, `font-bold` para el título de pantalla y las cifras. El cuerpo va sin peso.

`text-xs` nunca lleva una acción ni la única copia de un dato que el usuario necesita. El tamaño de
fuente del sistema se respeta: ningún `allowFontScaling={false}` y ninguna altura fija en un
contenedor con texto, que se usa `minHeight`.

Las cifras que cambian o que se comparan en columna (importes, cantidades, contadores) van con
números tabulares para que no bailen al actualizarse: `style={tabularNums}`, de `@/theme`. NativeWind
no tiene clase para esto.

## Forma

Tres radios, en `tokens.js`:

| Clase          | Valor | Para qué                                  |
| -------------- | ----- | ----------------------------------------- |
| `rounded-sm`   | 6     | Lo que va dentro de un control: miniatura |
| `rounded-md`   | 10    | Controles y filas: botón, campo, checkbox |
| `rounded-lg`   | 16    | Contenedores: tarjeta, bloque, hoja       |
| `rounded-full` |       | Chips, avatares, barra de progreso        |

Cuando un elemento redondeado va pegado al borde de otro, el radio de dentro es el de fuera menos el
padding que los separa. Una tarjeta `rounded-lg` con `p-2` lleva dentro piezas `rounded-sm`, no otra
vez `rounded-lg`.

## Espaciado

Escala de Tailwind, en múltiplos de 4. Lo habitual: `gap-2` entre elementos de una fila, `gap-3`
entre filas o bloques, `p-3` o `p-4` de relleno de tarjeta, `px-4` de margen lateral de pantalla.
Los medios pasos (`0.5`, `1.5`) solo para ajustar un chip o una insignia.

El área táctil mínima es `minTouchTarget` (44) de `@/theme`, puesta con `minHeight` y `minWidth` en
el `Pressable`. Si el dibujo es más pequeño, crece el área con `hitSlop`, no el dibujo.

## Elevación

No hay. Una tarjeta es `bg-surface`, con `border border-line` si necesita separarse de otra
superficie igual. La sombra en Android es `elevation`, que en modo oscuro no se ve y en claro
ensucia una interfaz plana.

Lo único que flota son las superposiciones de Paper (`Dialog`, `Snackbar`), que traen su propia
elevación y viven en `src/shared/ui`.

## Estados

- **Pulsado.** Baja la opacidad: `active:opacity-70` en filas, iconos y controles sin relleno,
  `active:opacity-80` en botones con relleno.
- **Deshabilitado o cargando.** `opacity-50`, sin estado pulsado, y `accessibilityState` al día.
- **Comprado.** Tachado, texto `muted` y checkbox relleno con su marca. Nunca solo el color.
- **Error.** Texto `danger` con el mensaje y el código entre paréntesis.
- **Vacío.** Una frase que dice qué hacer, centrada, con la acción principal debajo.

## Iconos

No hay librería de iconos. Los controles usan glifos de texto (`✕`, `✓`, `×`) dentro de un `Text`,
así que heredan color y peso como cualquier otro texto y cambian con el tema. Los emoji no se
pueden recolorear: valen de adorno junto a una etiqueta, nunca como único indicador de un estado ni
como única etiqueta de un botón.

## Movimiento

Poco y corto. Una fila que aparece o se recoloca tarda 180 ms. Lo que el usuario hace decenas de
veces en una compra, como marcar un artículo, cambia al instante. El detalle está en la skill.

## Lo que no se hace

- Sombras para dar relieve a una tarjeta.
- Un segundo color de acento, o `primary` en algo que no se pulsa ni está activo.
- Texto gris sobre un fondo de color.
- Tarjeta dentro de tarjeta.
- Animar la entrada de una pantalla entera o de una lista al cargar.
- Un radio, un tamaño o un color que no esté en las tablas de arriba.
- Componentes de Paper fuera de `Snackbar`, `Dialog` y `Portal`.

## Lo que hoy no cumple

Los cuatro incumplimientos que se midieron el 2026-10-05 (radios fuera de los tokens, cuatro
opacidades de pulsado, una sombra y cifras sin números tabulares) se arreglaron ese mismo día. Al
hacerlo aparecieron otros que siguen abiertos; quien toque estos ficheros que los arregle de paso
en vez de copiarlos:

- `MealPlannerScreen.tsx` usa `text-content-muted`, una clase que no existe: el color secundario es
  `text-muted`. Ese texto sale hoy con el color por defecto del sistema.
- En el mismo fichero y en algún otro hay `text-primary` y `bg-primary/15` sin su pareja `dark:`.
- `ShoppingModeScreen.tsx` y los componentes de alta y edición de artículos ponen tamaños de fuente
  y radios con números en `style` (`fontSize: 13`, `borderRadius: 18`) en vez de con las clases de
  la escala.
