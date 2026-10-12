-- ADR-0026, migración A: el hash del PIN sale de `members`, límite de intentos por miembro,
-- RPC para fijar y restablecer el PIN, invitados sin rol de admin y rotación del código al expulsar.
--
-- Ninguna firma existente cambia. La regla «una fila sin PIN con dueño no es reclamable» y la
-- invalidación de los PIN expuestos NO están aquí: van en la migración B (ADR-0026).
--
-- No aplicar al proyecto real sin haberla pasado antes por el de ensayo:
-- docs/guias/ensayar-una-migracion.md

-- Ninguna llamada a las funciones viejas puede escribir un hash entre la copia y el drop.
-- Dentro de un `do` porque `lock table` suelto exige un bloque de transacción explícito, y
-- `supabase db push` manda el fichero como un lote sin `begin`. El bloqueo dura hasta el final
-- de la transacción del lote.
do $
begin
  lock table public.members in access exclusive mode;
end $;

-- ---------------------------------------------------------------------------------------------
-- 1. member_secrets
-- ---------------------------------------------------------------------------------------------

create table if not exists member_secrets (
  member_id   uuid primary key references members(id) on delete cascade,
  pin_hash    text not null,
  exposed     boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table member_secrets enable row level security;

revoke all on member_secrets from public, anon, authenticated;

drop trigger if exists member_secrets_touch_updated_at on member_secrets;
create trigger member_secrets_touch_updated_at
  before update on member_secrets
  for each row execute function touch_updated_at();

do $$
declare
  v_expected bigint;
  v_copied bigint;
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'members' and column_name = 'pin_hash'
  ) then
    execute 'select count(*) from members where pin_hash is not null' into v_expected;

    execute
      'insert into member_secrets (member_id, pin_hash, exposed)
       select id, pin_hash, true from members where pin_hash is not null
       on conflict (member_id) do nothing';

    select count(*) into v_copied from member_secrets;

    if v_copied < v_expected then
      raise exception 'member_secrets: se esperaban % hashes y hay %', v_expected, v_copied;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. join_attempts: a quién iba dirigido el intento
-- ---------------------------------------------------------------------------------------------

alter table join_attempts
  add column if not exists member_id uuid references members(id) on delete set null;

create index if not exists join_attempts_member_idx
  on join_attempts (member_id, attempted_at desc)
  where member_id is not null;

create index if not exists join_attempts_attempted_at_idx
  on join_attempts (attempted_at);

-- ---------------------------------------------------------------------------------------------
-- 3. Invitados sin rol de admin
-- ---------------------------------------------------------------------------------------------

update members set is_admin = false where auth_user_id is null and is_admin;

alter table members drop constraint if exists members_admin_has_session;
alter table members
  add constraint members_admin_has_session check (not is_admin or auth_user_id is not null);

-- ---------------------------------------------------------------------------------------------
-- 4. Funciones internas. Sin grant a nadie: solo las llaman las RPC `security definer` de abajo,
--    que corren como su dueño. Se revoca también a `authenticated` porque los privilegios por
--    defecto de Supabase se lo conceden de forma directa a toda función nueva de `public`.
-- ---------------------------------------------------------------------------------------------

create or replace function pin_attempts_per_hour()
returns int
language sql immutable as $$ select 5 $$;

create or replace function pin_attempts_before_lock()
returns int
language sql immutable as $$ select 20 $$;

create or replace function is_valid_pin(p_pin text)
returns boolean
language sql immutable as $$ select p_pin is not null and p_pin ~ '^[0-9]{4}$' $$;

create or replace function member_has_history(p_member_id uuid)
returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from expenses e where e.paid_by_member_id = p_member_id)
      or exists (select 1 from expense_shares es where es.member_id = p_member_id)
      or exists (
        select 1 from settlements st
         where st.from_member_id = p_member_id or st.to_member_id = p_member_id
      )
$$;

create or replace function store_member_pin(p_member_id uuid, p_pin text)
returns void
language sql set search_path = public as $$
  insert into member_secrets (member_id, pin_hash, exposed)
  values (p_member_id, extensions.crypt(p_pin, extensions.gen_salt('bf')), false)
  on conflict (member_id) do update
    set pin_hash = excluded.pin_hash,
        exposed = false
$$;

revoke execute on function pin_attempts_per_hour()        from public, anon, authenticated;
revoke execute on function pin_attempts_before_lock()     from public, anon, authenticated;
revoke execute on function is_valid_pin(text)             from public, anon, authenticated;
revoke execute on function member_has_history(uuid)       from public, anon, authenticated;
revoke execute on function store_member_pin(uuid, text)   from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. create_community: misma firma. El hash va a member_secrets y el PIN se valida.
-- ---------------------------------------------------------------------------------------------

create or replace function create_community(p_name text, p_username text, p_pin text default null)
returns table (community_id uuid, join_code text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_id uuid;
  v_member_id uuid;
  v_code text;
  v_pin text := nullif(trim(coalesce(p_pin, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if v_pin is not null and not is_valid_pin(v_pin) then
    raise exception 'invalid_pin' using errcode = '22023';
  end if;

  v_code := generate_join_code();

  insert into communities (name, join_code)
  values (trim(p_name), v_code)
  returning id into v_id;

  insert into members (community_id, username, auth_user_id, is_admin)
  values (v_id, trim(p_username), auth.uid(), true)
  returning id into v_member_id;

  if v_pin is not null then
    perform store_member_pin(v_member_id, v_pin);
  end if;

  return query select v_id, v_code;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 6. join_community: misma firma y mismos estados
--    (ok, invalid_join_code, expired_join_code, username_taken, invalid_pin, too_many_attempts).
-- ---------------------------------------------------------------------------------------------

create or replace function join_community(p_join_code text, p_username text, p_pin text default null)
returns table (status text, community_id uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_username text := trim(p_username);
  v_pin text := nullif(trim(coalesce(p_pin, '')), '');
  v_community_id uuid;
  v_expires_at timestamptz;
  v_session_failures int;
  v_member_id uuid;
  v_member_auth_user_id uuid;
  v_member_pin_hash text;
  v_is_owner boolean;
  v_last_success timestamptz;
  v_recent_failures int;
  v_failures_since_success int;
  v_own_id uuid;
  v_own_is_admin boolean;
  v_own_pin_hash text;
  v_inherits_admin boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- `skip locked` para no esperar a reset_member_pin, que toca estas filas con la comunidad
  -- ya bloqueada.
  delete from join_attempts
   where id in (
     select a.id from join_attempts a
      where a.attempted_at < now() - interval '30 days'
        for update skip locked
   );

  select count(*) into v_session_failures
    from join_attempts a
   where a.auth_user_id = v_uid
     and not a.succeeded
     and a.attempted_at > now() - interval '15 minutes';

  if v_session_failures >= 10 then
    return query select 'too_many_attempts'::text, null::uuid;
    return;
  end if;

  select c.id, c.join_code_expires_at into v_community_id, v_expires_at
    from communities c
   where c.join_code = upper(trim(p_join_code));

  if v_community_id is null then
    insert into join_attempts (auth_user_id, succeeded) values (v_uid, false);
    return query select 'invalid_join_code'::text, null::uuid;
    return;
  end if;

  if v_expires_at <= now() then
    insert into join_attempts (auth_user_id, succeeded) values (v_uid, false);
    return query select 'expired_join_code'::text, null::uuid;
    return;
  end if;

  if v_pin is not null and not is_valid_pin(v_pin) then
    insert into join_attempts (auth_user_id, succeeded) values (v_uid, false);
    return query select 'invalid_pin'::text, null::uuid;
    return;
  end if;

  -- `for no key update` y no `for update`: serializa igual entre estas funciones y no frena las
  -- altas de artículos o gastos, que toman `for key share` por su clave foránea.
  -- Serializa todo lo que pasa en esta comunidad: el recuento de intentos, la comprobación del
  -- PIN, la adopción de una fila y el alta. remove_member, set_member_admin y reset_member_pin
  -- toman el mismo bloqueo.
  perform 1 from communities c where c.id = v_community_id for no key update;

  select m.id, m.auth_user_id into v_member_id, v_member_auth_user_id
    from members m
   where m.community_id = v_community_id
     and m.username = v_username
     and m.removed_at is null;

  select m.id, m.is_admin into v_own_id, v_own_is_admin
    from members m
   where m.community_id = v_community_id
     and m.auth_user_id = v_uid
     and m.removed_at is null;

  -- A. Ya existe un miembro activo con ese nombre -------------------------------------------
  if v_member_id is not null then
    v_is_owner := v_member_auth_user_id is not distinct from v_uid;

    select s.pin_hash into v_member_pin_hash
      from member_secrets s
     where s.member_id = v_member_id;

    if v_member_pin_hash is not null then
      if not v_is_owner then
        select max(a.attempted_at) into v_last_success
          from join_attempts a
         where a.member_id = v_member_id and a.succeeded;

        select count(*) into v_recent_failures
          from join_attempts a
         where a.member_id = v_member_id
           and not a.succeeded
           and a.attempted_at > now() - interval '1 hour';

        select count(*) into v_failures_since_success
          from join_attempts a
         where a.member_id = v_member_id
           and not a.succeeded
           and a.attempted_at > now() - interval '30 days'
           and (v_last_success is null or a.attempted_at > v_last_success);

        if v_recent_failures >= pin_attempts_per_hour()
           or v_failures_since_success >= pin_attempts_before_lock() then
          return query select 'too_many_attempts'::text, null::uuid;
          return;
        end if;
      end if;

      if v_pin is null
         or extensions.crypt(v_pin, v_member_pin_hash) <> v_member_pin_hash then
        insert into join_attempts (auth_user_id, succeeded, member_id)
        values (v_uid, false, case when v_is_owner then null else v_member_id end);
        return query select 'invalid_pin'::text, null::uuid;
        return;
      end if;
    end if;

    -- Llegados aquí: o el PIN coincide, o la fila no tiene PIN. Esto último sigue siendo
    -- reclamable por cualquiera hasta la migración B (ADR-0026).
    if not v_is_owner then
      -- Quien llama ya tenía otra fila en esta lista: la suelta antes de quedarse con esta,
      -- o el índice único (community_id, auth_user_id) rechaza el update.
      if v_own_id is not null then
        v_inherits_admin := coalesce(v_own_is_admin, false);

        delete from member_push_tokens t where t.member_id = v_own_id;
        delete from member_secrets s where s.member_id = v_own_id;

        if member_has_history(v_own_id) then
          update members m
             set auth_user_id = null,
                 is_admin = false
           where m.id = v_own_id;
        else
          delete from members m where m.id = v_own_id;
        end if;
      end if;

      -- El móvil que tenía esta fila deja de recibir sus notificaciones.
      delete from member_push_tokens t where t.member_id = v_member_id;

      update members m
         set auth_user_id = v_uid,
             is_admin = m.is_admin or v_inherits_admin
       where m.id = v_member_id;
    end if;

    if v_member_pin_hash is null and v_pin is not null then
      perform store_member_pin(v_member_id, v_pin);
    end if;

    insert into join_attempts (auth_user_id, succeeded, member_id)
    values (v_uid, true, v_member_id);
    return query select 'ok'::text, v_community_id;
    return;
  end if;

  -- B. Nadie se llama así y quien llama ya está en la lista: se renombra -----------------------
  if v_own_id is not null then
    select s.pin_hash into v_own_pin_hash
      from member_secrets s
     where s.member_id = v_own_id;

    if v_own_pin_hash is not null then
      if v_pin is null or extensions.crypt(v_pin, v_own_pin_hash) <> v_own_pin_hash then
        insert into join_attempts (auth_user_id, succeeded) values (v_uid, false);
        return query select 'invalid_pin'::text, null::uuid;
        return;
      end if;
    end if;

    begin
      update members m set username = v_username where m.id = v_own_id;
    exception when unique_violation then
      insert into join_attempts (auth_user_id, succeeded) values (v_uid, false);
      return query select 'username_taken'::text, null::uuid;
      return;
    end;

    if v_own_pin_hash is null and v_pin is not null then
      perform store_member_pin(v_own_id, v_pin);
    end if;

    insert into join_attempts (auth_user_id, succeeded, member_id)
    values (v_uid, true, v_own_id);
    return query select 'ok'::text, v_community_id;
    return;
  end if;

  -- C. Miembro nuevo ---------------------------------------------------------------------------
  begin
    insert into members (community_id, username, auth_user_id, is_admin)
    values (v_community_id, v_username, v_uid, false)
    returning id into v_member_id;
  exception when unique_violation then
    insert into join_attempts (auth_user_id, succeeded) values (v_uid, false);
    return query select 'username_taken'::text, null::uuid;
    return;
  end;

  if v_pin is not null then
    perform store_member_pin(v_member_id, v_pin);
  end if;

  insert into join_attempts (auth_user_id, succeeded, member_id)
  values (v_uid, true, v_member_id);
  return query select 'ok'::text, v_community_id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 7. add_guest_member: misma firma. Solo deja de nombrar la columna que se elimina.
-- ---------------------------------------------------------------------------------------------

create or replace function add_guest_member(p_community_id uuid, p_username text)
returns table (id uuid, username text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_caller_is_admin boolean;
  v_clean_username text;
  v_new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select m.is_admin into v_caller_is_admin
    from members m
   where m.community_id = p_community_id
     and m.auth_user_id = auth.uid()
     and m.removed_at is null;

  if v_caller_is_admin is null or not v_caller_is_admin then
    raise exception 'forbidden_not_admin' using errcode = '42501';
  end if;

  v_clean_username := trim(p_username);
  if char_length(v_clean_username) < 1 or char_length(v_clean_username) > 40 then
    raise exception 'invalid_username_length' using errcode = '22026';
  end if;

  if exists (
    select 1 from members m
     where m.community_id = p_community_id
       and m.username = v_clean_username
       and m.removed_at is null
  ) then
    raise exception 'username_taken' using errcode = '23505';
  end if;

  insert into members (community_id, username, auth_user_id, is_admin)
  values (p_community_id, v_clean_username, null, false)
  returning members.id into v_new_id;

  return query select v_new_id, v_clean_username;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 8. remove_member: misma firma. Bloqueo, admins con sesión y rotación del código.
-- ---------------------------------------------------------------------------------------------

create or replace function remove_member(p_community_id uuid, p_member_id uuid)
returns table (status text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_caller_member_id uuid;
  v_caller_is_admin boolean;
  v_target_is_admin boolean;
  v_target_community_id uuid;
  v_target_removed_at timestamptz;
  v_target_auth_user_id uuid;
  v_target_knows_code boolean;
  v_admin_count int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  perform 1 from communities c where c.id = p_community_id for no key update;

  select m.id, m.is_admin into v_caller_member_id, v_caller_is_admin
    from members m
   where m.community_id = p_community_id
     and m.auth_user_id = auth.uid()
     and m.removed_at is null;

  if v_caller_member_id is null or not v_caller_is_admin then
    raise exception 'forbidden_not_admin' using errcode = '42501';
  end if;

  select m.community_id, m.is_admin, m.removed_at, m.auth_user_id
    into v_target_community_id, v_target_is_admin, v_target_removed_at, v_target_auth_user_id
    from members m
   where m.id = p_member_id;

  if v_target_community_id is null
     or v_target_community_id <> p_community_id
     or v_target_removed_at is not null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;

  if p_member_id = v_caller_member_id then
    raise exception 'cannot_remove_self' using errcode = 'P0003';
  end if;

  if v_target_is_admin then
    select count(*) into v_admin_count
      from members m
     where m.community_id = p_community_id
       and m.is_admin
       and m.removed_at is null
       and m.auth_user_id is not null
       and m.id <> p_member_id;

    if v_admin_count < 1 then
      raise exception 'cannot_remove_last_admin' using errcode = 'P0004';
    end if;
  end if;

  -- Quien ha tenido sesión o PIN conoce el código de invitación. Un invitado que nunca entró, no.
  v_target_knows_code := v_target_auth_user_id is not null
    or exists (select 1 from member_secrets s where s.member_id = p_member_id);

  if v_target_knows_code then
    update communities c
       set join_code = generate_join_code(),
           join_code_expires_at = now() + join_code_lifetime()
     where c.id = p_community_id;
  end if;

  delete from member_push_tokens t where t.member_id = p_member_id;

  if member_has_history(p_member_id) then
    update members m set removed_at = now() where m.id = p_member_id;
    return query select 'archived'::text;
  else
    delete from members m where m.id = p_member_id;
    return query select 'deleted'::text;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 9. set_member_admin: misma firma. Bloqueo, y un invitado no puede ser admin.
-- ---------------------------------------------------------------------------------------------

create or replace function set_member_admin(p_community_id uuid, p_member_id uuid, p_is_admin boolean)
returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_caller_is_admin boolean;
  v_target_community_id uuid;
  v_target_removed_at timestamptz;
  v_target_auth_user_id uuid;
  v_admin_count int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  perform 1 from communities c where c.id = p_community_id for no key update;

  select m.is_admin into v_caller_is_admin
    from members m
   where m.community_id = p_community_id
     and m.auth_user_id = auth.uid()
     and m.removed_at is null;

  if v_caller_is_admin is null or not v_caller_is_admin then
    raise exception 'forbidden_not_admin' using errcode = '42501';
  end if;

  select m.community_id, m.removed_at, m.auth_user_id
    into v_target_community_id, v_target_removed_at, v_target_auth_user_id
    from members m
   where m.id = p_member_id;

  if v_target_community_id is null
     or v_target_community_id <> p_community_id
     or v_target_removed_at is not null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;

  if p_is_admin and v_target_auth_user_id is null then
    raise exception 'cannot_promote_guest' using errcode = 'P0005';
  end if;

  if not p_is_admin then
    select count(*) into v_admin_count
      from members m
     where m.community_id = p_community_id
       and m.is_admin
       and m.removed_at is null
       and m.auth_user_id is not null
       and m.id <> p_member_id;

    if v_admin_count < 1 then
      raise exception 'cannot_remove_last_admin' using errcode = 'P0004';
    end if;
  end if;

  update members m set is_admin = p_is_admin where m.id = p_member_id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 10. RPC nuevas
-- ---------------------------------------------------------------------------------------------

-- Estados: ok, invalid_pin (el nuevo está mal formado), wrong_pin (el actual no coincide),
-- too_many_attempts. Ojo: en join_community `invalid_pin` significa «no coincide».
create or replace function set_member_pin(
  p_community_id uuid,
  p_new_pin text,
  p_current_pin text default null
)
returns table (status text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_member_id uuid;
  v_pin_hash text;
  v_new_pin text := nullif(trim(coalesce(p_new_pin, '')), '');
  v_current_pin text := nullif(trim(coalesce(p_current_pin, '')), '');
  v_session_failures int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select m.id into v_member_id
    from members m
   where m.community_id = p_community_id
     and m.auth_user_id = v_uid
     and m.removed_at is null;

  if v_member_id is null then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;

  -- Solo cuentan los fallos de esta sesión: si contaran los dirigidos al miembro, un compañero
  -- podría impedirle cambiar su PIN gastándole los intentos desde fuera.
  select count(*) into v_session_failures
    from join_attempts a
   where a.auth_user_id = v_uid
     and not a.succeeded
     and a.attempted_at > now() - interval '15 minutes';

  if v_session_failures >= 10 then
    return query select 'too_many_attempts'::text;
    return;
  end if;

  if not is_valid_pin(v_new_pin) then
    return query select 'invalid_pin'::text;
    return;
  end if;

  select s.pin_hash into v_pin_hash
    from member_secrets s
   where s.member_id = v_member_id;

  if v_pin_hash is not null then
    if v_current_pin is null or extensions.crypt(v_current_pin, v_pin_hash) <> v_pin_hash then
      insert into join_attempts (auth_user_id, succeeded) values (v_uid, false);
      return query select 'wrong_pin'::text;
      return;
    end if;
  end if;

  perform store_member_pin(v_member_id, v_new_pin);

  insert into join_attempts (auth_user_id, succeeded, member_id)
  values (v_uid, true, v_member_id);
  return query select 'ok'::text;
end $$;

-- 'none', 'exposed' (el hash vino de members.pin_hash y ha podido leerse) o 'set'.
create or replace function my_member_pin_state(p_community_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select case
               when s.member_id is null then 'none'
               when s.exposed then 'exposed'
               else 'set'
             end
        from members m
        left join member_secrets s on s.member_id = m.id
       where m.community_id = p_community_id
         and m.auth_user_id = auth.uid()
         and m.removed_at is null
    ),
    'none'
  )
$$;

-- Deja la fila sin sesión y con un PIN temporal que se devuelve al admin. La persona entra con
-- su nombre y ese PIN, conserva su members.id y lo cambia con set_member_pin.
create or replace function reset_member_pin(p_community_id uuid, p_member_id uuid)
returns table (temp_pin text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_caller_member_id uuid;
  v_caller_is_admin boolean;
  v_target_community_id uuid;
  v_target_removed_at timestamptz;
  v_temp_pin text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  perform 1 from communities c where c.id = p_community_id for no key update;

  select m.id, m.is_admin into v_caller_member_id, v_caller_is_admin
    from members m
   where m.community_id = p_community_id
     and m.auth_user_id = auth.uid()
     and m.removed_at is null;

  if v_caller_member_id is null or not v_caller_is_admin then
    raise exception 'forbidden_not_admin' using errcode = '42501';
  end if;

  select m.community_id, m.removed_at into v_target_community_id, v_target_removed_at
    from members m
   where m.id = p_member_id;

  if v_target_community_id is null
     or v_target_community_id <> p_community_id
     or v_target_removed_at is not null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;

  if p_member_id = v_caller_member_id then
    raise exception 'cannot_reset_self' using errcode = 'P0003';
  end if;

  v_temp_pin := lpad(
    ((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 10000)::text,
    4,
    '0'
  );

  perform store_member_pin(p_member_id, v_temp_pin);

  delete from member_push_tokens t where t.member_id = p_member_id;
  -- Se desligan del miembro, no se borran: siguen contando para el límite de la sesión que
  -- los hizo. Es lo que levanta el bloqueo de esta fila.
  update join_attempts a set member_id = null where a.member_id = p_member_id;

  update members m
     set auth_user_id = null,
         is_admin = false
   where m.id = p_member_id;

  return query select v_temp_pin;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 11. El hash deja de existir en members. Lo último, con todas las funciones ya reescritas.
-- ---------------------------------------------------------------------------------------------

alter table members drop column if exists pin_hash;

-- ---------------------------------------------------------------------------------------------
-- 12. Permisos, con la firma exacta de cada función
-- ---------------------------------------------------------------------------------------------

revoke execute on function create_community(text, text, text)       from public, anon;
revoke execute on function join_community(text, text, text)         from public, anon;
revoke execute on function add_guest_member(uuid, text)             from public, anon;
revoke execute on function remove_member(uuid, uuid)                from public, anon;
revoke execute on function set_member_admin(uuid, uuid, boolean)    from public, anon;
revoke execute on function set_member_pin(uuid, text, text)         from public, anon;
revoke execute on function my_member_pin_state(uuid)                from public, anon;
revoke execute on function reset_member_pin(uuid, uuid)             from public, anon;

grant execute on function create_community(text, text, text)        to authenticated;
grant execute on function join_community(text, text, text)          to authenticated;
grant execute on function add_guest_member(uuid, text)              to authenticated;
grant execute on function remove_member(uuid, uuid)                 to authenticated;
grant execute on function set_member_admin(uuid, uuid, boolean)     to authenticated;
grant execute on function set_member_pin(uuid, text, text)          to authenticated;
grant execute on function my_member_pin_state(uuid)                 to authenticated;
grant execute on function reset_member_pin(uuid, uuid)              to authenticated;
