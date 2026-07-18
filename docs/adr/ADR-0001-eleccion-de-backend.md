# ADR-0001: Elección de backend (Supabase vs Firebase)

- Estado: Aceptado
- Fecha: 2026-07-18

## Contexto

La app necesita que varias personas compartan una lista y vean los cambios de las demás en
segundos, estando en redes y países distintos. Los datos son claramente relacionales:
una comunidad tiene miembros y artículos, y casi toda consulta filtra por comunidad.

Es un proyecto de una persona en fase beta, así que montar y mantener un backend propio
(servidor, WebSockets, despliegue, base de datos) es tiempo que no se dedica al producto.
La decisión real es qué BaaS, no si usar uno.

## Decisión

Supabase: Postgres + Realtime + Storage + Row Level Security.

Esta decisión ya estaba tomada en el documento maestro (§6.3). Se registra aquí porque el
repositorio debe poder explicarse solo, sin depender de que alguien lea un documento de
747 líneas para saber por qué hay un cliente de Supabase en `shared/lib/`.

## Alternativas consideradas

- **Firebase (Firestore).** Mejor offline-first de serie y push notifications nativas. Se
  descarta por el modelo documental: forzaría desnormalizar comunidad/miembros/artículos y
  las reglas de seguridad de Firestore son bastante menos expresivas que RLS para el
  aislamiento por comunidad, que es el requisito de seguridad central aquí.
- **Backend propio (Node + Postgres + WebSockets).** Control total, pero semanas de trabajo
  de infraestructura para un beta que aún no sabe si tendrá usuarios.
- **Local-first (PowerSync, ElectricSQL, Legend-State).** Resuelven offline y conflictos
  mucho mejor. Sobredimensionado para una lista de la compra donde el peor conflicto posible
  es que dos personas marquen el mismo artículo a la vez. Queda como ruta de migración si
  algún día hace falta concurrencia fuerte.

## Consecuencias

**A favor**

- Datos relacionales con las garantías de Postgres: claves foráneas, constraints, `check`.
- RLS como frontera de seguridad real, aplicada en la base de datos y no en el cliente.
- Tipos TypeScript generados desde el esquema (`supabase gen types`).
- Sin lock-in fuerte: por debajo es Postgres estándar y los datos son exportables.

**En contra**

- El offline avanzado no viene de serie: hay que montarlo con persistencia de TanStack Query
  sobre MMKV y una cola de mutaciones con NetInfo.
- Las push notifications requieren una pieza aparte (Expo Notifications u OneSignal).
- El modelo de autenticación no encaja con "sin cuentas", que es lo que obliga al diseño
  descrito en [ADR-0002](./ADR-0002-modelo-de-sesion-y-rls.md).
