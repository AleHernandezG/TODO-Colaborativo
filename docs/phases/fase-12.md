# Fase 12: Planificador Semanal de Menús y Consolidación a Lista de Compra (RF-15)

- **Fecha:** 2026-09-06
- **Estado:** Completada y verificada
- **Commit:** Pendiente de consolidación

---

## 1. Contexto y Objetivos

Con las recetas compartidas implementadas en la Fase 11, la comunidad necesitaba una herramienta visual y ágil para planificar las comidas y cenas a lo largo de los días de la semana y automatizar la generación de la lista de la compra de ingredientes sin duplicidades.

### Objetivos Principales:
1. **Entidad y Persistencia (`meal_plan_slots`)**: Guardar las asignaciones de comidas y cenas por día (lunes a domingo) asociadas a recetas o platos libres.
2. **Sincronización en tiempo real**: Actualización instantánea en todos los dispositivos de la comunidad cuando alguien planifica o modifica un plato.
3. **Consolidación Inteligente**: Sumar ingredientes repetidos entre diferentes recetas y escalar sus cantidades de acuerdo a los comensales programados.
4. **Volcado por Lotes**: Añadir los ingredientes necesarios a la lista de compra en un solo toque, con revisión previa para desmarcar los que ya se tienen en casa.
5. **Aislamiento Multi-tenant RLS**: Proteger el acceso para que ninguna comunidad pueda consultar ni alterar los menús de otra.

---

## 2. Implementación Técnica

### A. Base de Datos en Supabase
- **Migración**: `supabase/migrations/20260906200000_meal_planner_schema.sql`.
- **Tabla `public.meal_plan_slots`**:
  - `id`: UUID (PK).
  - `community_id`: FK a `communities(id)`.
  - `date`: `date` (`YYYY-MM-DD`).
  - `meal_type`: `'lunch' | 'dinner'`.
  - `recipe_id`: FK a `recipes(id)` con `on delete set null`.
  - `custom_dish_name`: Texto libre para platos sin receta formal.
  - `servings`: Número de comensales (1–100).
  - `notes`: Texto de notas adicionales.
  - `constraint meal_plan_slot_unique unique (community_id, date, meal_type)`.
- **Procedimientos Almacenados**:
  - `upsert_meal_slot`: Upsert transaccional que valida pertenencia mediante `member_community_ids()` y guarda o actualiza el slot.
  - `delete_meal_slot`: Borrado seguro por comunidad, fecha y turno.
- **Suscripción Realtime**: Añadida a la publicación `supabase_realtime` con `REPLICA IDENTITY FULL`.

### B. Capa de Dominio (`src/features/meal-planner/domain/`)
- `meal-plan.ts`: Tipos `MealPlanSlot`, `MealPlanSlotWithRecipe`, `ConsolidatedIngredient`.
- Funciones de cálculo:
  - `getWeekDates(referenceDate)`: Genera el rango lunes–domingo y la metadata de cada día (identificando el día actual `isToday`).
  - `consolidateMealPlanIngredients(slots)`: Algoritmo de agregación que escala según comensales y agrupa por clave normalizada (nombre, unidad, ID de catálogo).
- `__tests__/meal-plan.test.ts`: 6 tests unitarios verificando validaciones, utilidades de fecha y suma consolidada de ingredientes entre recetas.

### C. Capa de Datos (`src/features/meal-planner/data/`)
- `supabase-meal-planner-repository.ts`: Implementa `MealPlannerRepository` con llamadas a PostgREST (`meal_plan_slots` con join a `recipes` e ingredientes), RPCs y canales Realtime de Supabase.
- `__tests__/supabase-meal-planner-repository.test.ts`: Tests unitarios de consulta, guardado y eliminación con mocks tipados.

### D. Capa de Presentación (`src/features/meal-planner/presentation/`)
- `useMealPlanWeek`: Hook de consulta TanStack Query con reconciliación Realtime automática.
- `useUpsertMealSlot` y `useDeleteMealSlot`: Mutaciones para asignar o vaciar turnos de comida.
- `useAddMealPlanToList`: Mutación que genera UUIDs en cliente y vuelca en bloque a `items` con notificación push.
- `AssignMealModal`: Modal para elegir entre receta del catálogo o plato libre, con selector de comensales y notas.
- `ConsolidatedReviewModal`: Checklist para revisar ingredientes calculados y desmarcar existencias previas antes del volcado.
- `MealPlannerScreen`: Interfaz con selector de semana, tarjetas de días con estados vacíos e interactivos, y banner flotante de ingredientes calculados.

### E. Integración de Navegación y Rutas
- Ruta Expo Router: `src/app/meal-planner/index.tsx`.
- Accesos directos integrados en la barra de acciones de `ItemsScreen` y en la cabecera de `RecipesScreen`.

---

## 3. Verificación y Resultados

| Comprobación | Herramienta | Resultado |
| :--- | :--- | :--- |
| **Tests unitarios y de integración** | `npm test` | **58 suites pasadas / 408 tests pasados (100%)** |
| **Aislamiento RLS en backend real** | `npm run test:rls` | **65/65 comprobaciones correctas** (4 comprobaciones nuevas para meal planner) |
| **Tipado estricto TypeScript** | `npm run typecheck` | **0 errores** (`tsc --noEmit`) |
| **Linter** | `npm run lint` | **0 errores / 0 advertencias** (`expo lint`) |
| **Exportación Android (Hermes)** | `npx expo export --platform android` | **Bundle generado limpiamente** |

---

## 4. Decisiones de Arquitectura

- Registrado en [ADR-0022: Planificador semanal de menús y consolidación de ingredientes](file:///c:/Users/usuario/Desktop/Proyectos/TODO-Recetas-Movil/docs/adr/ADR-0022-planificador-semanal-de-menus-y-consolidacion.md).
