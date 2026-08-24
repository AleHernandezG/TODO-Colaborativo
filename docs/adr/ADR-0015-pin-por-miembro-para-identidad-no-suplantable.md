# ADR-0015: PIN por miembro para identidad no suplantable

- Estado: Aceptado
- Fecha: 2026-08-24
- Cumple el requisito de entrada de [ADR-0005](ADR-0005-reparto-de-gastos.md) para el Bloque B de la Fase 6 (RF-9).

## Contexto

En la versión beta, la identidad dentro de una comunidad se basa únicamente en un `username` y un `auth_user_id` anónimo generado en el dispositivo ([ADR-0002](ADR-0002-modelo-de-sesion-y-rls.md)).

Para la lista de la compra, este modelo ligero sin cuentas era suficiente. Sin embargo, [ADR-0005](ADR-0005-reparto-de-gastos.md) identificó un bloqueo fundamental antes de construir el reparto de gastos:
1. **Suplantación de identidad:** Cualquier persona con el `join_code` podía unirse y reclamar un nombre si este no estaba ya tomado por una sesión activa.
2. **Pérdida de identidad al cambiar de dispositivo:** Si un usuario cambiaba de móvil o borraba la app (generando un nuevo `auth.uid()`), no podía recuperar su miembro anterior (`username_taken`), perdiendo su historial de gastos, deudas y atribución.
3. **Falta de atribución estricta:** No era seguro afirmar quién pagó qué si cualquiera podía registrar gastos a nombre de otro o modificar registros ajenos.

## Decisión

Implementar un **PIN de 4 dígitos por miembro**, almacenado con hash seguro en la base de datos (`pgcrypto`), gestionado en las RPCs de creación y unión de comunidades:

1. **Columna `members.pin_hash`:**
   - Se añade `pin_hash text` a `members`.
   - Se almacena utilizando `extensions.crypt(p_pin, extensions.gen_salt('bf'))` (bcrypt). Nunca en texto plano.

2. **Flujo de `create_community`:**
   - Recibe `p_pin text`.
   - Valida que sea un PIN de 4 dígitos numéricos y guarda el `pin_hash` para el creador.

3. **Flujo de `join_community`:**
   - Recibe `p_join_code text`, `p_username text`, `p_pin text`.
   - Si el `username` ya existe en la comunidad:
     - Comprueba el PIN: `extensions.crypt(p_pin, pin_hash) = pin_hash`.
     - Si coincide: actualiza `auth_user_id = auth.uid()` en la fila de miembro existente. Esto permite al usuario **recuperar su identidad y miembro original (`members.id`)** desde un dispositivo nuevo.
     - Si no coincide: registra el intento fallido en `join_attempts` y devuelve el estado `'invalid_pin'`.
   - Si el `username` no existe:
     - Inserta el nuevo miembro con su `pin_hash` y su `auth_user_id`.

4. **Protección contra fuerza bruta:**
   - Un PIN de 4 dígitos tiene 10.000 combinaciones. La tabla `join_attempts` ya aplica un rate-limit estricto (máximo 10 intentos fallidos por `auth_user_id` en 15 minutos), bloqueando cualquier intento de adivinar el PIN.

5. **Compatibilidad hacia atrás:**
   - Miembros existentes con `pin_hash is null` establecerán su PIN automáticamente la primera vez que se unan con su nombre y un nuevo PIN.

## Consecuencias

### A favor
- **Identidad protegida:** Nadie puede entrar a una comunidad haciéndose pasar por otro miembro sin conocer su PIN.
- **Recuperación real sin email:** Los usuarios pueden cambiar de móvil o reinstalar la app y mantener su miembro, deudas y saldo intactos.
- **Sin fricción:** Solo 4 dígitos numéricos, sin contraseñas largas, correos ni confirmaciones complejas.
- **Desbloquea el Bloque B (Reparto de gastos):** Ahora existe un `members.id` no suplantable sobre el que imputar gastos de forma segura.

### En contra / Deuda asumida
- No hay mecanismo automático de "he olvidado mi PIN". Si alguien olvida su PIN en una lista beta, otro miembro de la comunidad tendría que eliminarlo o elegir otro nombre. Para la beta entre conocidos esto es un compromiso asumible.
