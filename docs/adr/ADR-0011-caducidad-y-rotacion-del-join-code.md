# ADR-0011: El código de invitación caduca y se puede cambiar

- Estado: Aceptado
- Fecha: 2026-08-05
- Toca el modelo de sesión que fijó [ADR-0002](ADR-0002-modelo-de-sesion-y-rls.md), sin sustituirlo.

## Contexto

En esta app no hay cuentas: el `join_code` **es** el control de acceso. Quien lo escribe entra en
la lista y ve la compra de una casa entera. Hasta ahora ese código era eterno y no se podía
cambiar, así que el modelo de seguridad real era «quien lo tuvo alguna vez, entra siempre».

El código no se filtra porque alguien lo adivine (para eso ya está el rate limit de
`join_community`, que corta a los 10 intentos fallidos en 15 minutos). Se filtra porque **se
comparte**: se pega en un grupo de WhatsApp, se dicta por teléfono, se queda en el historial de una
conversación con alguien que ya no vive en esa casa. Un secreto que circula así necesita dos cosas
que no teníamos: dejar de valer solo, y poder cambiarse a mano cuando sospechas que se ha ido de
las manos.

## Decisión

Tres piezas, todas en la migración `20260805120000_join_code_expiry.sql`.

### 1. El código caduca a los 7 días

```sql
create or replace function join_code_lifetime()
returns interval
language sql immutable as $$ select interval '7 days' $$;

alter table communities
  add column join_code_expires_at timestamptz not null default now() + join_code_lifetime();
```

La vida del código vive en una función y no repetida en los dos sitios que la necesitan (el
`default` de la columna y `rotate_join_code`). Cambiar el plazo es cambiar una línea, no buscar
dónde estaba escrito el `interval '7 days'` la segunda vez.

Siete días porque el caso normal es «monto la lista y en esta semana se apunta la familia». Un
plazo más corto obliga a regenerar en mitad de la fiesta; uno más largo se parece demasiado a no
caducar. La expresión del `default` es estable, así que Postgres la evalúa una vez al aplicar la
migración: **las listas que ya existen se llevan 7 días desde ese momento**, no desde que se
crearon.

### 2. `join_community` distingue caducado de inexistente

```sql
if v_expires_at <= now() then
  insert into join_attempts (auth_user_id, succeeded) values (auth.uid(), false);
  return query select 'expired_join_code'::text, null::uuid;
  return;
end if;
```

Dos detalles deliberados. El primero, que **un código caducado cuenta como intento fallido** igual
que uno inexistente: si no contara, un atacante podría barrer el espacio de códigos sin gastar rate
limit en cuanto acertara con uno vencido, y de paso sabría que esa lista existe. El segundo, que la
app sí separa los dos casos en pantalla, porque para el usuario no son lo mismo: «ese código no
existe, revísalo» manda a mirar si te has equivocado tecleando, y «ese código ha caducado, pide uno
nuevo» manda a hablar con quien te lo pasó.

### 3. `rotate_join_code`: cualquier miembro, efecto inmediato

```sql
create or replace function rotate_join_code(p_community_id uuid)
returns table (join_code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
...
  if p_community_id not in (select member_community_ids()) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;
```

El código nuevo se genera con `generate_join_code()` (la misma que usa `create_community`, que ya
reintenta hasta dar con uno libre) y **sobrescribe** al anterior. No hay periodo de gracia: en
cuanto alguien pulsa el botón, el código viejo devuelve `invalid_join_code` a quien lo pruebe. Eso
es lo que se espera de un botón que existe para cortar el acceso a alguien; un solapamiento de
"cinco minutos más" convertiría la acción en una sugerencia.

Puede rotarlo **cualquier miembro** porque en esta app no hay roles: `members` no distingue quién
creó la lista de quién se unió ayer, y añadir esa distinción solo para este botón sería inventar
un modelo de permisos entero por la puerta de atrás. Quien ya está dentro tiene acceso completo a
la lista de todas formas; poder cambiar el código no le da nada que no tuviera.

Rotar **no expulsa a nadie**. La pertenencia vive en `members` y el código solo sirve para entrar
la primera vez.

### En la app, el código deja de ser estado de cliente

Era un campo más de `Community` dentro del store persistido de Zustand, copiado ahí al crear o
entrar en la lista. Con la rotación eso pasa a ser una copia rancia de un dato del servidor, que es
justo lo que las reglas del proyecto prohíben. Ahora es una query de TanStack Query
(`['join-code', communityId]`, persistida) y `rotate_join_code` escribe la respuesta en la caché
con `setQueryData`.

La mutación **no es optimista** y usa `networkMode: 'always'`: el código nuevo lo inventa la base de
datos y no hay forma de adivinarlo, así que el botón se queda en carga y espera. Es la misma
excepción que `create_community`. Sin red falla con `OfflineError` y avisa, en vez de encolarse:
una rotación reenviada sola media hora después cambiaría el código a espaldas de quien acabara de
compartirlo.

`Community.joinCode` se queda donde está, sin usarse para pintar. Quitarlo obligaría a migrar el
estado ya persistido en los móviles que tienen la app instalada, y a cambio de nada.

## Alternativas consideradas

**No caducar y confiar solo en el botón de rotar.** Es menos molesto y cubre el caso en el que
sospechas de una filtración. Se descarta porque el caso peligroso es el otro: nadie sospecha nada,
el código lleva ocho meses en un grupo de WhatsApp y nadie se acuerda de que existe. La caducidad
protege sin que haya que acordarse.

**Códigos de un solo uso.** Un código, una persona. Es lo más seguro y lo más pesado: la forma
normal de usar esto es soltar el código en el grupo de la familia y que entren cuatro. Obligaría a
generar y repartir uno por cabeza.

**Caducidad por número de usos** (vale para N personas). Mismo problema que el anterior en
pequeño, y además hay que explicarle al usuario un contador. La caducidad por tiempo se entiende
sin explicación.

**Guardar solo `created_at` y calcular la caducidad en el cliente.** Menos columnas, y una regla de
seguridad que se aplica en el sitio donde el usuario controla el reloj. La comprobación tiene que
estar en la base de datos; la de la app es solo para pintar «caduca dentro de 3 días».

**Historial de códigos** (tabla `join_codes` con `revoked_at` en vez de sobrescribir la columna).
Permitiría auditar quién entró con qué código y dar un margen al código viejo. Se descarta por
tamaño: una tabla más, un join más en la ruta crítica de entrar, y un valor de auditoría que esta
app no aprovecha. El día que haga falta saber quién invitó a quién, esa tabla es el sitio.

**Cerrar la rotación a quien creó la lista.** Necesita una columna de rol en `members` y una
respuesta para «se fue de la casa quien la creó». Ver arriba.

## Consecuencias

**A favor**

- El único secreto de la app se puede cambiar, y se cambia solo si nadie lo toca.
- El código que enseña la pantalla es el del servidor, no una copia de cuando entraste. Si otra
  persona lo rota, tu móvil acaba enterándose.
- `expired_join_code` le dice al usuario qué hacer (pedir uno nuevo) en vez de mandarlo a revisar
  un código que escribió bien.

**En contra**

- **El otro móvil puede enseñar un código muerto durante un rato.** `communities` no está en la
  publicación de Realtime, así que la rotación no se propaga sola. Se refresca al volver a la app
  (`useAppForeground`, el mismo hook que ya usaba la lista) y al tirar hacia abajo. El fallo
  residual es enseñar un código que ya no vale hasta el siguiente refetch; quien lo use verá
  «ese código no existe». Meter `communities` en Realtime lo arregla del todo y se hará si molesta.
- **Una lista abandonada no se puede compartir sin tocar el botón.** Vuelves a los tres meses,
  quieres apuntar a alguien y lo primero es generar un código nuevo. Es el precio de la caducidad y
  la pantalla lo dice con todas las letras en vez de dejar copiar un código que va a fallar.
- Una columna más y una RPC más que mantener; `db.types.ts` hay que regenerarlo.

## Notas

Las comprobaciones de aislamiento (`npm run test:rls`) suben a 24: que un no-miembro no pueda rotar
el código de otra lista, que el intento fallido no lo cambie, que cualquier miembro sí pueda, que
el anterior muera al instante y que uno caducado dé `expired_join_code`. La última necesita
`SUPABASE_SECRET_KEY` en `.env` para poder envejecer la fila a mano; sin ella el script salta esa
comprobación y avisa.
