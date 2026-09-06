# ADR-0022: Planificador semanal de menús y consolidación de ingredientes para la lista de compra

- **Fecha:** 2026-09-06
- **Estado:** Aceptado
- **Decisores:** Equipo de TODO-Recetas-Móvil

---

## Contexto

Tras la implantación del módulo de recetas compartidas en la Fase 11 (RF-14), la comunidad dispone de recetas culinarias con ingredientes y raciones ajustables. Sin embargo, para la gestión del día a día del hogar, los miembros necesitan organizar qué platos van a comer y cenar a lo largo de la semana y aprovisionar los ingredientes de forma conjunta.

Sin un planificador:
1. Los miembros deben entrar receta por receta y volcar sus ingredientes uno a uno.
2. Si dos recetas de la semana utilizan el mismo ingrediente (p. ej. huevos, cebollas o patatas), se añaden filas duplicadas y dispersas en la lista de la compra en lugar de sumar las cantidades requeridas.
3. No existe un calendario común que permita a los miembros de la casa saber de un vistazo qué se va a comer o cenar hoy, mañana o el fin de semana.

---

## Decisión

### 1. Modelo de Datos en PostgreSQL (`meal_plan_slots`)
Se introduce la tabla `public.meal_plan_slots`:
- `community_id`: vinculada a la comunidad activa (`references public.communities on delete cascade`).
- `date`: fecha exacta (`date`), garantizando que la semana corresponda inequívocamente a los días de lunes a domingo.
- `meal_type`: enumerado estricto `'lunch' | 'dinner'`.
- `recipe_id`: clave foránea opcional a `public.recipes(id)` con `on delete set null`. Si una receta se borra, el slot no se destruye sino que mantiene su registro.
- `custom_dish_name`: campo de texto libre para comidas informales que no requieran receta guardada (p. ej. "Comer fuera", "Sobras de pasta", etc.).
- `servings`: número de comensales previsto para esa comida concreta (por defecto 4, validado entre 1 y 100).
- `notes`: notas operativas (p. ej. "Cocinar el día antes").
- **Restricción de unicidad estricta**: `unique (community_id, date, meal_type)`, lo que simplifica enormemente la gestión y permite operaciones idempotentes mediante `upsert_meal_slot`.

### 2. Aislamiento y Sincronización Realtime
- Las políticas de seguridad a nivel de fila (RLS) utilizan `community_id in (select member_community_ids())` para `SELECT`, `INSERT`, `UPDATE` y `DELETE`.
- La tabla se publica en `supabase_realtime` con `REPLICA IDENTITY FULL`, permitiendo que cuando un miembro asigne una comida o cena, el resto de dispositivos de la comunidad actualicen su vista semanal de inmediato sin recargar.

### 3. Consolidación de Ingredientes en Dominio Desacoplado
La consolidación de ingredientes de la semana se implementa como una **función pura** en `src/features/meal-planner/domain/meal-plan.ts` (`consolidateMealPlanIngredients`):
- Itera sobre todos los slots de la semana que tengan una receta asignada.
- Escala las cantidades de cada ingrediente respecto a las raciones configuradas en el slot frente a las raciones base de la receta (`scaleIngredientQuantity`).
- Agrupa por clave compuesta: `nombre_normalizado + unidad_normalizada + catalog_product_id`.
- Suma acumulativa de cantidades numéricas redondeadas a dos decimales.
- Conserva el registro de las recetas de origen para informar al usuario de qué platos demandan dicho ingrediente.

### 4. Volcado Inteligente a la Lista de Compra
- Se proporciona un modal de revisión previa donde los miembros pueden revisar la lista consolidada y desmarcar productos que ya tengan en stock en su despensa o nevera.
- Los artículos seleccionados se insertan en lote mediante `supabaseItemRepository.addMany` con IDs generados en cliente (ADR-0010) y se despacha una notificación push colaborativa al resto del grupo (ADR-0020).

---

## Consecuencias

### Positivas
- **Cero duplicados en la compra**: La compra semanal de ingredientes se consolida de forma transparente.
- **Flexibilidad total**: Se pueden combinar recetas oficiales con fotos y productos del catálogo con platos libres.
- **Rendimiento offline y local**: El cálculo del calendario y la consolidación se efectúan en cliente sin sobrecargar el backend.
- **Aislamiento multi-tenant garantizado**: Protegido por RLS y verificado con tests automatizados.

### Negativas / Mitigaciones
- Si una receta cambia de ingredientes en mitad de la semana, el slot mantiene la referencia a la receta y el menú consolidado reflejará los nuevos ingredientes automáticamente en la siguiente consulta.
