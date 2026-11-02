# Estado de partida del rediseño

Cómo estaban las quince pantallas el 2026-11-03, antes de que el T-16 tocase ninguna. Es lo que lee
el T-16.2 para decidir el diseño nuevo, y la vara contra la que se mide cada incremento del 3 al 8:
una pantalla rediseñada se vuelve a medir igual y se compara con su tabla de aquí.

## Cómo se midió

- **Móvil:** POCO F5 con HyperOS, 440 dpi, 1080 × 2400 px (392,7 × 872,7 dp).
- **Versión:** 1.3.1 con el update `01a19e5d`; el pie de la lista dice `v1.3.1 · 01a19e5d`.
- **Datos:** la lista «E2E PIN», con el móvil dentro como Ana (admin). Tiene 25 artículos en 10
  pasillos, tres recetas, cinco huecos del menú, cuatro gastos y una liquidación. Cómo se sembró, en
  [`fase-16.md`](../phases/fase-16.md), apartado 5.
- **Variantes:** claro y oscuro con la letra al 100 %, claro al 115 % y al 200 %, y oscuro al 200 %
  solo en lista, modo supermercado y gastos. El 115 % es como lo tiene Alejandro.
- **Herramienta:** `npm run inspect:screen`, con la app en frío y el enlace `listacompra://<ruta>`
  para cada pantalla. Capturas, XML, logcat y salida del script en
  `~/tools/capturas/2026-11/<variante>/<pantalla>.*`, fuera del repo.

Cómo leer las tablas:

- **< 48 dp** es lo que pide P-02 y donde falla el script. **< 44 dp** es lo que no llega ni al
  `minTouchTarget` de hoy. Un pulsable de 44 cuenta en la primera columna y no en la segunda.
- **Separación < 8 dp** cuenta parejas de pulsables vecinos, así que puede salir más alto que el
  número de pulsables.
- **Repetidos** son etiquetas que comparten dos o más pulsables: TalkBack lee lo mismo para cosas
  distintas.
- **Aplastados** son textos más estrechos que dos letras, incluidos los de 0 px que uiautomator deja
  fuera del XML y el script saca del logcat.
- El script **no ve el `hitSlop`**. `ItemRow` y `Checkbox` miden 44 en el volcado y 60 de verdad.
- uiautomator da el rectángulo **recortado a lo que se ve**. Un botón que se sale por el borde mide
  lo que queda dentro y no sale como «fuera de pantalla». Los desbordes de abajo salen de mirar las
  capturas, no del script.
- Al 200 % bajan las cifras de < 48 porque todo crece. Lo que aparece a esa escala son cortes y
  desbordes, que solo están en las capturas.
- En Nuevo gasto y Nueva receta el teclado se abre al entrar y tapa media pantalla. La medida es la
  de lo que queda visible.

## Resumen

Ordenado por lo que impide usar la pantalla, no por el número de marcas. Cifras de claro al 100 %.

| Pantalla | Ruta | Lo peor | Pulsables | < 48 dp | Separación < 8 dp |
| --- | --- | --- | --- | --- | --- |
| Lista | `/list` | El título mide 19 px; al 200 % solo hay botones | 7 (28 abajo) | 6 (25 abajo) | 5 (20 abajo) |
| Menú semanal | `/meal-planner` | El panel de consolidados tapa la semana | 4 | 4 | 0 |
| Editar receta | `/recipes/<id>/edit` | Al 200 % Guardar se sale de la pantalla | 24 | 19 | 13 |
| Nueva receta | `/recipes/new` | Lo mismo, y el teclado abierto al entrar | 12 | 10 | 3 |
| Modo supermercado | `/shopping-mode` | Filtros de 37,8 dp a 4 dp uno de otro | 13 | 5 | 2 |
| Nuevo gasto | `/expenses/new` | Teclado al entrar; filas a 3 dp; nombres repetidos | 20 | 18 | 21 |
| Miembros | `/members` | «Hacer admin» ×4 a 3,3 dp de «Eliminar» | 10 | 10 | 4 |
| Receta | `/recipes/<id>` | El atrás se anuncia «Cancelar» | 11 | 11 | 4 |
| Recetas | `/recipes` | Búsqueda de 41,8 dp; atrás «Cancelar» | 7 | 4 | 1 |
| Gastos | `/expenses` | «Saldar» ×3; al 200 % el título se corta | 6 | 6 | 0 |
| Historial | `/expenses/history` | Dos pulsables de 44 | 6 | 2 | 0 |
| Gasto | `/expenses/<id>` | Solo el atrás, de 44 | 1 | 1 | 0 |
| Crear lista | `/create` | Botones de 45,8 y 47,6; al 200 % se corta la ayuda del PIN | 5 | 2 | 0 |
| Unirse | `/join` | Igual que Crear | 5 | 2 | 0 |
| Bienvenida | `/` | Botones de 45,8 y 47,6 | 2 | 2 | 0 |

Totales de las quince pantallas, sin contar la parte de abajo de la lista:

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 133 | 102 | 5 | 53 | 9 | 5 |
| oscuro-100 | 133 | 102 | 5 | 53 | 9 | 5 |
| claro-115 | 132 | 93 | 5 | 57 | 8 | 5 |
| claro-200 | 119 | 42 | 1 | 39 | 8 | 5 |
| oscuro-200 (3 pantallas) | 22 | 2 | 1 | 7 | 1 | 3 |

El modo oscuro da las mismas cifras que el claro en todas las pantallas: el tema cambia colores, no
tamaños. Lo que el oscuro tenga de contraste no lo mide este script; lo mira `tokens.test.ts`.

Sin nombre para TalkBack, pisados y fuera de pantalla salen a 0 en todas.

## Lista

`/list`. La pantalla que más se usa y la peor.

Lo que impide usarla:

- El título «Lista E2E PIN» mide 6,9 dp de ancho (19 px) y 221,5 de alto: una letra por línea. Es
  también el pulsable del selector de listas, así que cambiar de lista es acertar a una tira de 7 dp.
- «E2E PIN» y «Estás dentro como Ana» miden 0 px. No se ven y uiautomator no los pone en el XML.
- Al 100 % y al 115 % no se ve ningún artículo sin desplazar: la cabecera y sus cinco botones se
  comen la pantalla. Al 115 % el campo de alta queda cortado por abajo.
- Al 200 % solo se ven los cinco botones. No hay título, ni artículos, ni barra de alta.

Lo que molesta:

- Modo Compra, Menú, Recetas, PDF y Gastos miden 44 dp de alto, a 6,9 dp uno de otro.
- Abajo, desplazando al 100 % (`list-abajo`): 28 pulsables, 25 por debajo de 48 y 20 separaciones.
  Las filas de artículo salen con 44 por el `hitSlop`, que el script no ve. Copiar, Compartir,
  «Generar código nuevo» y «Gestionar miembros» miden 44 de verdad, con 6,9 dp de separación.

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 7 | 6 | 1 | 5 | 0 | 3 |
| oscuro-100 | 7 | 6 | 1 | 5 | 0 | 3 |
| claro-115 | 7 | 6 | 1 | 6 | 0 | 3 |
| claro-200 | 6 | 1 | 1 | 5 | 0 | 3 |
| oscuro-200 | 6 | 1 | 1 | 5 | 0 | 3 |

## Menú semanal

`/meal-planner`.

Lo que impide usarla:

- El panel de ingredientes consolidados tapa los días de la semana. Lo que la pantalla tiene para
  planificar no se ve.
- Al 200 % toda la pantalla es el panel azul.
- «10 ingredientes calculados» y «Consolidados sumando las recetas planificadas» miden 0 px.

Lo que molesta:

- «Añadir a la lista» llega a x = 1070 de 1080 px: sin margen a la derecha.
- Los cuatro pulsables por debajo de 48: Volver (57,8 × 44), semana anterior y siguiente (44 × 44)
  y «Añadir a la lista» (44 de alto).

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 4 | 4 | 0 | 0 | 0 | 2 |
| oscuro-100 | 4 | 4 | 0 | 0 | 0 | 2 |
| claro-115 | 4 | 4 | 0 | 0 | 0 | 2 |
| claro-200 | 3 | 3 | 0 | 0 | 0 | 2 |

## Editar receta

`/recipes/<id>/edit`.

Lo que impide usarla:

- Al 200 % la cabecera sale como «CancelarEditar receta Guardar», sin espacios, y Guardar se sale
  por la derecha (el volcado lo da en [761,123][1080,256], recortado al borde). Sin Guardar no hay
  forma de terminar.
- Al 200 % «Hacer foto» y «De la galería» se salen por los dos lados.

Lo que molesta:

- Al 200 %, «Las cantidades se ajustarán…» queda cortado y «+ Añadir ingrediente» va pegado a
  «Ingredientes».
- 19 de 24 pulsables por debajo de 48 y 13 separaciones: cantidad, unidad, nombre y «Quitar
  ingrediente» van en una fila de 44 dp.
- «Quitar ingrediente» y «g, ml, uds...» se repiten en cada ingrediente sin decir cuál.

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 24 | 19 | 0 | 13 | 2 | 0 |
| oscuro-100 | 24 | 19 | 0 | 13 | 2 | 0 |
| claro-115 | 24 | 19 | 0 | 13 | 2 | 0 |
| claro-200 | 16 | 8 | 0 | 7 | 1 | 0 |

## Nueva receta

`/recipes/new`. La misma pantalla que editar, vacía.

Lo que impide usarla:

- Al 200 %, la misma cabecera sin espacios con Guardar fuera, y los mismos botones de foto
  desbordados.
- El teclado se abre al entrar y tapa la mitad de abajo.

Lo que molesta:

- 10 de 12 pulsables por debajo de 48 y 3 separaciones.

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 12 | 10 | 0 | 3 | 0 | 0 |
| oscuro-100 | 12 | 10 | 0 | 3 | 0 | 0 |
| claro-115 | 12 | 10 | 0 | 3 | 0 | 0 |
| claro-200 | 12 | 7 | 0 | 3 | 0 | 0 |

## Modo supermercado

`/shopping-mode`. Se usa de pie y con una mano: aquí el área táctil pesa más que en ninguna otra.

Lo que impide usarla:

- Los tres filtros («Por comprar», «En el carro», «Todos») miden 37,8 dp de alto (38,5 al 115 %) y
  están a 4 dp uno de otro. Son los únicos por debajo de 44 de toda la app, junto al título de la
  lista y la búsqueda de recetas.

Lo que molesta:

- Al 200 % los filtros ocupan tres líneas.
- Salir mide 58,9 × 44 y «Finalizar compra» 45,8 de alto.
- Las filas de artículo salen recortadas por el scroll; el script las avisa y no las mide.

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 13 | 5 | 3 | 2 | 0 | 0 |
| oscuro-100 | 13 | 5 | 3 | 2 | 0 | 0 |
| claro-115 | 12 | 5 | 3 | 3 | 0 | 0 |
| claro-200 | 10 | 0 | 0 | 2 | 0 | 0 |
| oscuro-200 | 11 | 0 | 0 | 2 | 0 | 0 |

## Nuevo gasto

`/expenses/new`.

Lo que impide usarla:

- El concepto coge el foco al entrar y el teclado tapa media pantalla, justo donde está el reparto.
- Las filas del reparto están a 3,3 y 3,6 dp una de otra. Cada fila es un pulsable de todo el ancho
  con otro dentro, el checkbox de 44 dp.
- Tú, Bea, Carla, Dani y Eva salen dos veces, como quién paga y como reparto, sin decir cuál es
  cuál. En la fila «Tú», el checkbox se anuncia «Ana».

Lo que molesta:

- 18 de 20 pulsables por debajo de 48 y 21 separaciones. Los chips de quién paga miden 44 de alto a
  6,9 dp.
- Al 200 % salió además el aviso de Gboard «Tamaño de fuente de los emojis y del teclado», que es
  del sistema y no de la app.

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 20 | 18 | 0 | 21 | 5 | 0 |
| oscuro-100 | 20 | 18 | 0 | 21 | 5 | 0 |
| claro-115 | 20 | 18 | 0 | 21 | 5 | 0 |
| claro-200 | 20 | 10 | 0 | 13 | 5 | 0 |

## Miembros

`/members`. El caso de la fase 15, apartado 14.

Lo que impide usarla:

- «Hacer admin» (111,3 × 44) está a 3,3 dp de «Eliminar X» (44 × 44). Un dedo que va a dar admin
  puede quitar a la persona de la lista.

Lo que molesta:

- «Hacer admin» aparece cuatro veces con la misma etiqueta. TalkBack no dice a quién.
- Los 10 pulsables están por debajo de 48, también Volver y «Añadir invitado».

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 10 | 10 | 0 | 4 | 1 | 0 |
| oscuro-100 | 10 | 10 | 0 | 4 | 1 | 0 |
| claro-115 | 10 | 10 | 0 | 4 | 1 | 0 |
| claro-200 | 10 | 5 | 0 | 4 | 1 | 0 |

## Receta

`/recipes/<id>`.

Lo que impide usarla:

- El atrás enseña «‹ Recetas» y TalkBack lo anuncia «Cancelar». Quien no ve la pantalla no sabe que
  es volver.

Lo que molesta:

- 11 de 11 pulsables por debajo de 48 al 100 % y 4 separaciones.
- Al 200 %, «Deseleccionar» queda cortado por la derecha.

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 11 | 11 | 0 | 4 | 0 | 0 |
| oscuro-100 | 11 | 11 | 0 | 4 | 0 | 0 |
| claro-115 | 11 | 7 | 0 | 4 | 0 | 0 |
| claro-200 | 11 | 4 | 0 | 4 | 0 | 0 |

## Recetas

`/recipes`.

Lo que impide usarla: nada.

Lo que molesta:

- La búsqueda mide 41,8 dp de alto.
- El atrás también se anuncia «Cancelar».
- Menú y «+ Nueva» están a 7,3 dp.

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 7 | 4 | 1 | 1 | 0 | 0 |
| oscuro-100 | 7 | 4 | 1 | 1 | 0 | 0 |
| claro-115 | 7 | 4 | 1 | 1 | 0 | 0 |
| claro-200 | 7 | 1 | 0 | 1 | 0 | 0 |

## Gastos

`/expenses`.

Lo que impide usarla: nada al 100 %. Al 200 % el título se corta en «Re...».

Lo que molesta:

- «Saldar» se repite tres veces sin decir entre quién.
- Los 6 pulsables por debajo de 48 al 100 %.
- Al 200 %, las iniciales «BE» se salen del círculo y el total sale como «Gasto total de la
  lista244,88 €», sin espacio.

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 6 | 6 | 0 | 0 | 1 | 0 |
| oscuro-100 | 6 | 6 | 0 | 0 | 1 | 0 |
| claro-115 | 6 | 4 | 0 | 2 | 0 | 0 |
| claro-200 | 5 | 1 | 0 | 0 | 1 | 0 |
| oscuro-200 | 5 | 1 | 0 | 0 | 1 | 0 |

## Historial de gastos

`/expenses/history`. Dos pulsables de 44 dp, el resto bien.

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 6 | 2 | 0 | 0 | 0 | 0 |
| oscuro-100 | 6 | 2 | 0 | 0 | 0 | 0 |
| claro-115 | 6 | 2 | 0 | 0 | 0 | 0 |
| claro-200 | 6 | 1 | 0 | 0 | 0 | 0 |

## Gasto

`/expenses/<id>`. Solo el atrás, de 44 dp, en todas las variantes.

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 1 | 1 | 0 | 0 | 0 | 0 |
| oscuro-100 | 1 | 1 | 0 | 0 | 0 | 0 |
| claro-115 | 1 | 1 | 0 | 0 | 0 | 0 |
| claro-200 | 1 | 1 | 0 | 0 | 0 | 0 |

## Crear lista

`/create`. Dos botones de 45,8 y 47,6 dp; al 115 % uno llega a 48. Al 200 % la ayuda del PIN,
«4 dígitos para proteger tu…», queda cortada.

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 5 | 2 | 0 | 0 | 0 | 0 |
| oscuro-100 | 5 | 2 | 0 | 0 | 0 | 0 |
| claro-115 | 5 | 1 | 0 | 0 | 0 | 0 |
| claro-200 | 5 | 0 | 0 | 0 | 0 | 0 |

## Unirse

`/join`. Igual que Crear lista, con el mismo corte de la ayuda del PIN al 200 %.

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 5 | 2 | 0 | 0 | 0 | 0 |
| oscuro-100 | 5 | 2 | 0 | 0 | 0 | 0 |
| claro-115 | 5 | 1 | 0 | 0 | 0 | 0 |
| claro-200 | 5 | 0 | 0 | 0 | 0 | 0 |

## Bienvenida

`/`, medida tras `pm clear` y abierta desde el lanzador. «Crear una lista» mide 45,8 dp de alto y
«Tengo un código», 47,6. Al 200 % los dos pasan de 48 y el título se parte en un ancho estrecho.

| Variante | Pulsables | < 48 dp | < 44 dp | Separación < 8 dp | Repetidos | Aplastados |
| --- | --- | --- | --- | --- | --- | --- |
| claro-100 | 2 | 2 | 0 | 0 | 0 | 0 |
| oscuro-100 | 2 | 2 | 0 | 0 | 0 | 0 |
| claro-115 | 2 | 1 | 0 | 0 | 0 | 0 |
| claro-200 | 2 | 0 | 0 | 0 | 0 | 0 |

## Lo que se repite en toda la app

Para el T-16.2, que decide los componentes antes que las pantallas:

- **Los botones de texto miden 44 dp de alto** porque `minTouchTarget` es 44. Subir el token a 48 en
  el T-16.3 quita la mayoría de las 102 marcas de una vez. Los botones con relleno (Guardar gasto,
  Añadir gasto, Finalizar compra) miden 45,8 y se quedan cortos aunque no estén en 44.
- **La separación más común es de 6,9 dp**, entre botones de cabecera, chips y acciones de fila.
  Subir el área a 48 sin tocar el hueco puede dejarla igual o peor: el T-16.2 tiene que fijar el
  hueco mínimo entre pulsables, no solo su tamaño.
- **Las cabeceras no aguantan la letra grande.** Lista, editar receta, nueva receta y gastos rompen
  al 200 % por lo mismo: un título y varios botones en una sola fila sin dejar que bajen a otra.
- **Etiquetas repetidas en las acciones por fila** («Hacer admin», «Saldar», «Quitar ingrediente»):
  la etiqueta accesible tiene que llevar de quién es la fila.
- **El atrás se llama «Cancelar»** en Recetas y Receta.
