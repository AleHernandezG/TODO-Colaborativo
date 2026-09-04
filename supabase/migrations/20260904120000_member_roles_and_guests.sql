-- ADR-0017: Gestión de miembros, roles, bajas y participantes invitados (RF-11 y RF-12)

-- 1. Modificación de columnas en members
alter table members
  add column if not exists is_admin boolean not null default false,
  add column if not exists removed_at timestamptz default null;

alter table members
  alter column auth_user_id drop not null;

-- 2. Asignar is_admin = true al miembro creador/más antiguo de cada comunidad existente
with first_members as (
  select distinct on (community_id) id
  from members
  order by community_id, created_at asc
)
update members
   set is_admin = true
 where id in (select id from first_members);

-- 3. Adaptación de restricciones únicas a índices parciales (activos)
alter table members drop constraint if exists members_community_id_username_key;
alter table members drop constraint if exists members_community_id_auth_user_id_key;

create unique index if not exists idx_members_active_username
  on members (community_id, username)
  where removed_at is null;

create unique index if not exists idx_members_active_auth_user
  on members (community_id, auth_user_id)
  where removed_at is null and auth_user_id is not null;

create index if not exists idx_members_community_active
  on members (community_id)
  where removed_at is null;

-- 4. Realtime y Replica Identity para members
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'members'
  ) then
    alter publication supabase_realtime add table members;
  end if;
end $$;

alter table members replica identity full;

-- 5. Actualización de funciones RLS para aislar miembros archivados
create or replace function member_community_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select community_id from members where auth_user_id = auth.uid() and removed_at is null
$$;

create or replace function current_member_id(p_community_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select id from members
   where auth_user_id = auth.uid()
     and community_id = p_community_id
     and removed_at is null
$$;

revoke execute on function member_community_ids() from public, anon;
grant execute on function member_community_ids() to authenticated;

revoke execute on function current_member_id(uuid) from public, anon;
grant execute on function current_member_id(uuid) to authenticated;

-- 6. create_community: elimina sobrecargas previas y marca al creador como is_admin = true
drop function if exists create_community(text, text, text);
drop function if exists create_community(text, text);

create or replace function create_community(p_name text, p_username text, p_pin text default null)
returns table (community_id uuid, join_code text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_id uuid;
  v_code text;
  v_pin_hash text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  v_code := generate_join_code();

  if p_pin is not null and trim(p_pin) <> '' then
    v_pin_hash := extensions.crypt(trim(p_pin), extensions.gen_salt('bf'));
  end if;

  insert into communities (name, join_code)
  values (trim(p_name), v_code)
  returning id into v_id;

  insert into members (community_id, username, auth_user_id, pin_hash, is_admin)
  values (v_id, trim(p_username), auth.uid(), v_pin_hash, true);

  return query select v_id, v_code;
end $$;

revoke execute on function create_community(text, text, text) from public, anon;
grant execute on function create_community(text, text, text) to authenticated;

-- 7. join_community: elimina sobrecargas previas, filtra activos y permite adoptar invitados
drop function if exists join_community(text, text, text);
drop function if exists join_community(text, text);

create or replace function join_community(p_join_code text, p_username text, p_pin text default null)
returns table (status text, community_id uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_community_id uuid;
  v_expires_at timestamptz;
  v_failed_attempts int;
  v_member_id uuid;
  v_member_pin_hash text;
  v_member_auth_user_id uuid;
  v_existing_self_id uuid;
  v_pin_hash text;
begin
  select count(*) into v_failed_attempts
    from join_attempts
   where auth_user_id = auth.uid()
     and not succeeded
     and attempted_at > now() - interval '15 minutes';

  if v_failed_attempts >= 10 then
    return query select 'too_many_attempts'::text, null::uuid;
    return;
  end if;

  select id, join_code_expires_at into v_community_id, v_expires_at
    from communities
   where join_code = upper(trim(p_join_code));

  if v_community_id is null then
    insert into join_attempts (auth_user_id, succeeded) values (auth.uid(), false);
    return query select 'invalid_join_code'::text, null::uuid;
    return;
  end if;

  if v_expires_at <= now() then
    insert into join_attempts (auth_user_id, succeeded) values (auth.uid(), false);
    return query select 'expired_join_code'::text, null::uuid;
    return;
  end if;

  if p_pin is not null and trim(p_pin) <> '' then
    v_pin_hash := extensions.crypt(trim(p_pin), extensions.gen_salt('bf'));
  end if;

  -- Comprobar si ya existe un miembro ACTIVO con ese nombre en la comunidad
  select id, pin_hash, auth_user_id into v_member_id, v_member_pin_hash, v_member_auth_user_id
    from members
   where community_id = v_community_id
     and username = trim(p_username)
     and removed_at is null;

  if v_member_id is not null then
    -- Si el miembro no tiene PIN (invitado sin PIN o miembro legado): reclamar identidad
    if v_member_pin_hash is null then
      update members
         set auth_user_id = auth.uid(),
             pin_hash = coalesce(v_pin_hash, pin_hash)
       where id = v_member_id;

      insert into join_attempts (auth_user_id, succeeded) values (auth.uid(), true);
      return query select 'ok'::text, v_community_id;
      return;
    else
      -- Miembro con PIN existente: validar PIN
      if p_pin is null or extensions.crypt(trim(p_pin), v_member_pin_hash) <> v_member_pin_hash then
        insert into join_attempts (auth_user_id, succeeded) values (auth.uid(), false);
        return query select 'invalid_pin'::text, null::uuid;
        return;
      end if;

      -- PIN correcto: reasignar auth_user_id al dispositivo actual
      update members set auth_user_id = auth.uid() where id = v_member_id;

      insert into join_attempts (auth_user_id, succeeded) values (auth.uid(), true);
      return query select 'ok'::text, v_community_id;
      return;
    end if;
  end if;

  -- El miembro no existe con ese nombre: comprobar si este auth_user_id ya tenía otro miembro activo en esta comunidad
  select id into v_existing_self_id
    from members
   where community_id = v_community_id
     and auth_user_id = auth.uid()
     and removed_at is null;

  if v_existing_self_id is not null then
    update members
       set username = trim(p_username),
           pin_hash = coalesce(v_pin_hash, pin_hash)
     where id = v_existing_self_id;
  else
    insert into members (community_id, username, auth_user_id, pin_hash, is_admin)
    values (v_community_id, trim(p_username), auth.uid(), v_pin_hash, false);
  end if;

  insert into join_attempts (auth_user_id, succeeded) values (auth.uid(), true);
  return query select 'ok'::text, v_community_id;
end $$;

revoke execute on function join_community(text, text, text) from public, anon;
grant execute on function join_community(text, text, text) to authenticated;

-- 8. RPC remove_member: baja física si no hay historial contable; archivo si lo hay
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
  v_admin_count int;
  v_has_history boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- Verificar que el invocador sea miembro activo y admin de p_community_id
  select id, is_admin into v_caller_member_id, v_caller_is_admin
    from members
   where community_id = p_community_id
     and auth_user_id = auth.uid()
     and removed_at is null;

  if v_caller_member_id is null or not v_caller_is_admin then
    raise exception 'forbidden_not_admin' using errcode = '42501';
  end if;

  -- Verificar que el miembro objetivo pertenezca a la comunidad y esté activo
  select community_id, is_admin, removed_at into v_target_community_id, v_target_is_admin, v_target_removed_at
    from members
   where id = p_member_id;

  if v_target_community_id is null or v_target_community_id <> p_community_id or v_target_removed_at is not null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;

  -- Invariante: no auto-expulsión
  if p_member_id = v_caller_member_id then
    raise exception 'cannot_remove_self' using errcode = 'P0003';
  end if;

  -- Invariante: si el objetivo es admin, asegurar que quede al menos otro admin activo
  if v_target_is_admin then
    select count(*) into v_admin_count
      from members
     where community_id = p_community_id
       and is_admin = true
       and removed_at is null
       and id <> p_member_id;

    if v_admin_count < 1 then
      raise exception 'cannot_remove_last_admin' using errcode = 'P0004';
    end if;
  end if;

  -- Comprobar si tiene historial en gastos, cuotas o liquidaciones
  v_has_history := exists (
    select 1 from expenses where paid_by_member_id = p_member_id
  ) or exists (
    select 1 from expense_shares where member_id = p_member_id
  ) or exists (
    select 1 from settlements where from_member_id = p_member_id or to_member_id = p_member_id
  );

  if v_has_history then
    update members set removed_at = now() where id = p_member_id;
    return query select 'archived'::text;
  else
    delete from members where id = p_member_id;
    return query select 'deleted'::text;
  end if;
end $$;

revoke execute on function remove_member(uuid, uuid) from public, anon;
grant execute on function remove_member(uuid, uuid) to authenticated;

-- 9. RPC add_guest_member: crea participante sin cuenta ni PIN
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

  select is_admin into v_caller_is_admin
    from members
   where community_id = p_community_id
     and auth_user_id = auth.uid()
     and removed_at is null;

  if v_caller_is_admin is null or not v_caller_is_admin then
    raise exception 'forbidden_not_admin' using errcode = '42501';
  end if;

  v_clean_username := trim(p_username);
  if char_length(v_clean_username) < 1 or char_length(v_clean_username) > 40 then
    raise exception 'invalid_username_length' using errcode = '22026';
  end if;

  if exists (
    select 1 from members
     where community_id = p_community_id
       and username = v_clean_username
       and removed_at is null
  ) then
    raise exception 'username_taken' using errcode = '23505';
  end if;

  insert into members (community_id, username, auth_user_id, pin_hash, is_admin)
  values (p_community_id, v_clean_username, null, null, false)
  returning members.id into v_new_id;

  return query select v_new_id, v_clean_username;
end $$;

revoke execute on function add_guest_member(uuid, text) from public, anon;
grant execute on function add_guest_member(uuid, text) to authenticated;

-- 10. RPC set_member_admin: otorga o revoca rol de administrador
create or replace function set_member_admin(p_community_id uuid, p_member_id uuid, p_is_admin boolean)
returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_caller_member_id uuid;
  v_caller_is_admin boolean;
  v_target_community_id uuid;
  v_target_removed_at timestamptz;
  v_admin_count int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select id, is_admin into v_caller_member_id, v_caller_is_admin
    from members
   where community_id = p_community_id
     and auth_user_id = auth.uid()
     and removed_at is null;

  if v_caller_is_admin is null or not v_caller_is_admin then
    raise exception 'forbidden_not_admin' using errcode = '42501';
  end if;

  select community_id, removed_at into v_target_community_id, v_target_removed_at
    from members
   where id = p_member_id;

  if v_target_community_id is null or v_target_community_id <> p_community_id or v_target_removed_at is not null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;

  if not p_is_admin then
    select count(*) into v_admin_count
      from members
     where community_id = p_community_id
       and is_admin = true
       and removed_at is null
       and id <> p_member_id;

    if v_admin_count < 1 then
      raise exception 'cannot_remove_last_admin' using errcode = 'P0004';
    end if;
  end if;

  update members
     set is_admin = p_is_admin
   where id = p_member_id;
end $$;

revoke execute on function set_member_admin(uuid, uuid, boolean) from public, anon;
grant execute on function set_member_admin(uuid, uuid, boolean) to authenticated;
