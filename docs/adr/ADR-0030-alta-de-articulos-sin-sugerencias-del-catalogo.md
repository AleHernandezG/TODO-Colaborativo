# ADR-0030: El alta de artículos no sugiere productos del catálogo

- Estado: Aceptado (2026-11-17)
- Fecha: 2026-11-17
- Relacionado: [ADR-0012](ADR-0012-catalogo-de-productos-de-supermercado.md),
  [ADR-0013](ADR-0013-fuente-del-catalogo-mercadona.md),
  [ADR-0014](ADR-0014-origen-de-la-foto-del-articulo.md),
  [ADR-0024](ADR-0024-modo-supermercado-y-categorias-de-articulos.md),
  [ADR-0028](ADR-0028-navegacion-por-pestanas.md)

## Contexto

Desde la fase de RF-10, al escribir en el campo de añadir de la Lista salen debajo productos de
Mercadona con su foto y su precio orientativo (`CatalogSuggestions` en `AddItemBar`). Escribir
«agua» enseña media docena de aguas de marca. Elegir una enlaza el artículo con
`catalog_product_id`, y de ahí salen su foto (ADR-0014) y su precio de referencia.

El 2026-11-17 Alejandro pidió quitarlas: «son muy molestas en vez de ayudar», y quiere que se añada
lo que uno escribe, sin más. Es la misma línea que sacó Recetas y Menú de la app en el T-16.2
(ADR-0028): la app simple por ahora.

`DESIGN.md` y el prompt del T-16.4 las daban por decididas. Este ADR las saca.

Lo que se comprobó en el código antes de decidir:

- La categoría del artículo no depende del catálogo. Sale del nombre con `inferItemCategory`
  (`items/domain/item-category.ts`), así que «agua» sigue cayendo en su pasillo.
- El precio de referencia solo se ve en las sugerencias y en la fila de un artículo enlazado. Ningún
  gasto lo usa: `price_cents` no sale de `features/catalog`.
- RF-10 ya pedía que, con el catálogo vacío o sin red, la app se comportara igual que sin él. Quitar
  las sugerencias deja la app en ese caso, que está probado.

## Alternativas

- **Dejarlas como están.** Es lo que pide el diseño, y es lo que Alejandro no quiere.
- **Un interruptor para encenderlas.** Un ajuste más en una app sin pantalla de ajustes, para gente
  que no sabe usar apps. Nadie lo pidió.
- **Sacarlas solo cuando el nombre escrito coincide casi entero con un producto.** Menos ruido, pero
  sigue saliendo algo que no se pidió, y el umbral habría que afinarlo con datos que no tenemos.
- **Borrar el catálogo entero**: tablas, ingesta semanal y `features/catalog`. Es lo más limpio,
  pero toca esquema y producción (regla 1), deja sin foto a los artículos que ya están enlazados y
  deshacerlo costaría una migración y rehacer la ingesta.

## Decisión

1. **El campo de añadir de la Lista no consulta el catálogo.** Se añade lo que se escribe, con su
   categoría inferida del nombre y la que elija la persona. Un artículo nuevo sale siempre con
   `catalog_product_id` a `null`.
2. **Se esconde, no se borra**, como Recetas y Menú: `AddItemBar` deja de pintar
   `CatalogSuggestions`. `features/catalog`, sus tests, `search_catalog`, las tablas, la ingesta
   semanal y `test:rls` se quedan como están.
3. **Los artículos que ya están enlazados siguen igual**: su foto del catálogo sale como dice
   ADR-0014, y si su fila enseña precio, lo enseña con «orientativo» y su antigüedad (regla 6).
4. Va en el T-16.3, junto a Recetas y Menú, por update a la 1.3.1: es un cambio de
   `presentation/`, sin nada nativo.

ADR-0012, ADR-0013 y ADR-0014 siguen vigentes: el catálogo existe y la regla de la foto no cambia.
Lo que cambia es que la app ya no lo ofrece al escribir. RF-10 queda fuera de la app hasta nueva
orden, como RF-14 y RF-15.

## Consecuencias

- **Los artículos nuevos no traen foto sola.** Quien quiera foto la hace o la elige de la galería.
  Era el atajo principal de RF-10.
- **La app deja de enseñar precios** salvo en los artículos viejos enlazados. Con ellos se va la
  única pista de cuánto cuesta algo antes de ir a comprar.
- La ingesta semanal (`catalog-ingest.yml`) sigue corriendo para dar foto a esos artículos viejos.
  Si un día no queda ninguno enlazado, apagarla es quitar el workflow, y se decide entonces.
- `features/catalog` queda con código que nadie monta desde la Lista. Lo sigue usando
  `IngredientInputRow` de recetas, que tampoco tiene pantalla (ADR-0028). Se queda en el array
  `features` de `eslint.config.js` y en el umbral de cobertura.
- Un móvil que no reciba el update del T-16.3 sigue sugiriendo. Es esperado y no se arregla.
- Volver atrás es devolver `CatalogSuggestions` a `AddItemBar`. Cómo se pintan entonces se decide
  en un ADR que sustituya a este.

## Fuentes

- `src/features/items/presentation/components/AddItemBar.tsx`, `ItemsScreen.tsx` y
  `src/features/catalog/index.ts`, leídos el 2026-11-17.
- `docs/especificacion-y-roadmap.md`, RF-10, criterio de aceptación sobre el catálogo vacío.
- La petición de Alejandro en la sesión del 2026-11-17.
