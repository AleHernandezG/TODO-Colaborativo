# ADR-0029: El PIN temporal sale expuesto, y la migración B no deja filas libres

- Estado: Aceptado (2026-11-17). Alejandro aprobó el diseño el 2026-11-03, antes de escribir el SQL
- Fecha: 2026-11-03
- Relacionado: [ADR-0026](ADR-0026-pin-fuera-de-members-y-recuperacion-de-identidad.md) (apartado
  «Migración B», puntos 1 y 2), [ADR-0017](ADR-0017-gestion-de-miembros-y-roles.md),
  [P-06](../plan/PREGUNTAS.md#p-06--restablecer-otra-vez-un-pin-temporal-que-se-perdió)
- Migración: `supabase/migrations/20261103120000_unclaimable_rows_and_exposed_pins.sql`

## Contexto

La migración B de ADR-0026 tenía tres puntos: borrar los PIN expuestos, que una fila sin PIN con
dueño deje de ser reclamable contestando `username_taken`, y exigir PIN para adoptar a un invitado.
Al diseñarla en el incremento 6 del T-15 salieron tres cosas que el ADR no previó.

**El PIN temporal no avisaba.** `reset_member_pin` guarda el temporal con `store_member_pin`, que pone
`exposed = false`. `my_member_pin_state` devuelve `set` y la persona que entra con el temporal no ve
la tarjeta «Cambia tu PIN», aunque el admin lo ha visto entero. Comprobado en el POCO el 2026-11-03
con el update `01a1a227`: Bea entró con el temporal y no salió la tarjeta (`fase-15.md`, apartado 15,
tramo c5).

**Borrar todos los expuestos abre filas.** Un PIN expuesto en una fila sin sesión, la de alguien que
cambió de móvil o un invitado adoptado antes de la A, es lo único que protege esa fila. Sin él, y con
el punto 3 de la B, la adopta cualquiera que tenga el código y escriba cuatro cifras. Lo encontró
`migration-reviewer` al revisar el diseño.

**`username_taken` empuja al duplicado.** El 1.3.1 siempre manda PIN. Con `username_taken` pinta «Ese
nombre ya está cogido en esta lista. Prueba con otro» (`es.json:49`), y el dueño de esa fila que
entra desde un móvil nuevo acaba creando «Ana2». Con `invalid_pin` pinta «Ese nombre ya tiene PIN y
no es este. Si eres tú y lo has olvidado, pide a una persona admin de la lista que te lo restablezca»
(`es.json:46`), que es lo que tiene que hacer.

Lo que no se puede cambiar: los APK instalados conocen seis estados de `join_community`, y uno nuevo
lo tratan como error desconocido.

## Alternativas

- **Una columna `temporary` en `member_secrets`** para el temporal. Separa los dos motivos, pero
  `my_member_pin_state` necesitaría un cuarto estado que el 1.3.1 no conoce, o mapearlo a `exposed`
  igualmente. Una columna más para el mismo resultado en pantalla.
- **Cambiar `store_member_pin` para que reciba `exposed`.** Toca la firma de una función que usan
  cinco RPC y obliga a reescribirlas todas en la B. Un `update` después de llamarla, bajo el mismo
  bloqueo de la comunidad, da lo mismo sin tocar nada más.
- **Borrar todos los expuestos, como dice ADR-0026.** Deja libres las filas sin sesión que tenían un
  PIN expuesto. El riesgo de que alguien conozca ese hash viejo es menor que el de dejar la fila sin
  ninguna protección.
- **`username_taken` siempre, como dice ADR-0026.** Funciona para los clientes viejos, pero al dueño
  con el 1.3.1 le dice que pruebe otro nombre.
- **Un estado nuevo `claimed_by_other`.** Más claro, y rompe todos los APK instalados.

## Decisión

1. **`member_secrets.exposed` significa «este PIN lo conoce alguien más que su dueño».** Ahora cubre
   dos motivos: el hash vino de `members.pin_hash` (ADR-0026) o lo generó un admin con
   `reset_member_pin`. `reset_member_pin` marca el temporal como `exposed` justo después de
   guardarlo. `store_member_pin` sigue devolviéndolo a `false`, así que el primer cambio con
   `set_member_pin` lo limpia.
2. **La B borra solo los PIN expuestos de filas con sesión.** Su dueño sigue dentro y ve «Ponte un
   PIN». Los de filas sin sesión se quedan. En la misma migración, los temporales que nadie ha usado
   (fila activa sin sesión, con secreto y sin `exposed`) pasan a `exposed`. Sustituye al punto 1 de
   la B de ADR-0026.
3. **Una fila sin PIN solo la reclama su dueño.** Si llama otra sesión, o es un invitado y no viene
   PIN, `join_community` no toca nada. Contesta `invalid_pin` si la llamada trae PIN y
   `username_taken` si no. El fallo se anota solo contra la sesión que llama, no contra el miembro,
   para no gastarle al dueño sus intentos. La comprobación va antes de soltar la fila propia de quien
   llama, para que probar un nombre ajeno no cueste la suya. Sustituye al punto 2 de la B de
   ADR-0026. El punto 3 se queda como estaba: un invitado se adopta con un PIN válido.

`generate_join_code()` y `join_code_lifetime()` dejan de ser ejecutables por `authenticated`, como ya
pedía ADR-0026 para la primera. La segunda tenía el mismo hueco.

## Consecuencias

- Quien entra con un temporal ve «Cambia tu PIN. Otra persona ha podido verlo» sin cambiar nada en
  el cliente: el 1.3.1 ya pinta `exposed` así.
- **Una fila sin sesión con un PIN expuesto sigue abierta a quien conozca ese hash viejo.** Hace
  falta haberlo leído antes del 2026-10-12 y romperlo, y el límite de 5 fallos por hora y 20 en total
  sigue valiendo. Se cierra cuando su dueño vuelve a entrar y lo cambia, o cuando un admin se lo
  restablece.
- **El temporal que se pierde sigue sin poder sacarse otra vez** hasta que la fila tiene sesión de
  nuevo. Es P-06, sin decidir.
- `invalid_pin` le confirma a quien ataca que el nombre existe, igual que `username_taken`. No le dice
  si la fila tiene PIN o no.
- Un cliente sin campo de PIN, el 1.2.0, recibe «nombre cogido» también cuando el nombre es suyo y
  entra desde otro móvil. Tiene que pedir a un admin que le restablezca y entrar con el temporal, que
  ese APK no sabe pedir. Afecta a quien no actualice.
- `exposed` ya no basta para saber si un hash se filtró por el fallo de `members`. Lo distingue un
  `updated_at` igual al instante en que se aplicó la A, porque la copia lo puso a `now()`. Ese
  instante se anota antes de aplicar la B (`min(updated_at) where exposed`), porque el `update` de
  la B vuelve a tocar `updated_at` en los temporales que marca.
- Una llamada que ya estaba dentro de la función vieja cuando se aplica la B termina con el cuerpo
  viejo. Por eso la migración bloquea `member_secrets` para escritura mientras dura, con un
  `lock_timeout` de 5 s para no dejar a la app esperando detrás si algo retiene la tabla, y después
  se cuentan los temporales pendientes, que tienen que salir 0. Bloquear también `members` no
  cerraba nada más y abría un ciclo de bloqueos con `set_member_pin`, `reset_member_pin` y
  `join_community`, que escriben primero en `member_secrets` y luego tocan `members`.

## Fuentes

- `supabase/migrations/20261012120000_member_secrets_and_identity_hardening.sql`: `store_member_pin`
  (línea 116), el bloque A de `join_community` (309 a 335) y `reset_member_pin` (691). Leído el
  2026-11-03.
- `src/shared/lib/i18n/es.json`, líneas 46 y 49, y el mapeo de `invalid_pin` a `wrong_pin` en
  `src/features/community/data/supabase-community-repository.ts`. Leído el 2026-11-03.
- PostgreSQL 17, modos de bloqueo explícitos: https://www.postgresql.org/docs/17/explicit-locking.html
  (consultado el 2026-11-03).
- Informe de `migration-reviewer` sobre el diseño, en `docs/phases/fase-15.md`, apartado 15.
