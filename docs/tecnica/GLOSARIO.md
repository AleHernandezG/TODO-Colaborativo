# Glosario

Hablamos en castellano y codificamos en inglés. Esta tabla fija la correspondencia para que no
aparezcan tres nombres distintos para lo mismo. Dice lo mismo, fila por fila, que la tabla
«Vocabulario del dominio» de `CLAUDE.md`: si cambias una, cambias la otra. Un término nuevo se añade
aquí antes de usarlo en el código.

| Término | En código | Significado |
| --- | --- | --- |
| Lista | `community` | Lo que comparte un grupo: artículos, gastos, recetas y menú. La interfaz dice «lista»; el código y el esquema dicen `community` desde la fase 0 |
| Miembro | `member` | Una persona dentro de una lista, con nombre único en ella. Una misma sesión puede ser miembro de varias listas |
| Pertenencia | `Membership` | Que una sesión esté en una lista, con su nombre allí. Es la unidad del selector de listas |
| Lista activa | `useActiveCommunityStore` | La lista que estoy mirando ahora. Es estado del cliente; a qué listas pertenezco es del servidor (ADR-0025) |
| Código de invitación | `join_code` | Código legible para entrar en una lista, sin `O/0` ni `I/1`. Caduca a los 7 días y se puede rotar (ADR-0011) |
| PIN | `pin` | Cuatro dígitos por miembro para que nadie pueda entrar con tu nombre. Su hash vive en `member_secrets` (ADR-0026) |
| Administrador | `isAdmin` / `is_admin` | Miembro que puede quitar a otros y restablecer un PIN (ADR-0017) |
| Invitado | `isGuest` | Participante de los gastos que no tiene la app (RF-12) |
| Artículo | `item` | Una fila de la lista de la compra: nombre, cantidad, foto opcional, categoría y estado |
| Pendiente / comprado | `purchased` | Estado de un artículo. En pantalla va siempre con icono y texto, nunca solo con color |
| Categoría | `ItemCategory` | Pasillo del supermercado al que pertenece un artículo (ADR-0024) |
| Modo supermercado | `shopping-mode` | Pantalla para comprar: artículos agrupados por pasillo y pantalla siempre encendida |
| Catálogo | `catalog_products` | Productos de Mercadona para sugerir nombre, foto y precio. Única tabla compartida entre listas (ADR-0012, ADR-0013) |
| Precio de referencia | `price_cents` + `price_checked_at` | Precio del catálogo con su fecha. Orientativo: no es un gasto hasta que alguien lo confirma |
| Gasto | `expense` | Un pago hecho por un miembro y repartido entre varios, en céntimos (ADR-0005) |
| Liquidación | `Settlement` | Un pago entre miembros para saldar deudas |
| Balance | `MemberBalance` | Lo que cada miembro ha pagado menos lo que le toca, calculado en `domain/`, nunca guardado |
| Receta | `recipe` | Ingredientes reutilizables que se pueden volcar a la lista (ADR-0021) |
| Menú semanal | `meal-planner` / `MealPlanSlot` | Recetas puestas en días y comidas de una semana, que se consolidan en la lista (ADR-0022) |
| Cola offline | `setMutationDefaults` + `mutationKey` | Cambios hechos sin red que se envían al reconectar (ADR-0009) |
| Presencia | `PresenceRepository` | Quién mira la lista ahora, por Realtime |
| Paquete | `T-NN` | Una fase del ROADMAP, con el mismo número (ADR-0027) |
| Incremento | — | Un trozo de un paquete que se hace y se prueba en una sola sesión |
