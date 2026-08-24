-- ADR-0015: PIN por miembro para identidad no suplantable

create extension if not exists pgcrypto with schema extensions;

alter table members
  add column if not exists pin_hash text;

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

  insert into members (community_id, username, auth_user_id, pin_hash)
  values (v_id, trim(p_username), auth.uid(), v_pin_hash);

  return query select v_id, v_code;
end $$;

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

  -- Comprobar si ya existe un miembro con ese nombre en la comunidad
  select id, pin_hash into v_member_id, v_member_pin_hash
    from members
   where community_id = v_community_id
     and username = trim(p_username);

  if v_member_id is not null then
    -- El miembro existe: validar el PIN para recuperar/reclamar la identidad
    if v_member_pin_hash is not null then
      if p_pin is null or extensions.crypt(trim(p_pin), v_member_pin_hash) <> v_member_pin_hash then
        insert into join_attempts (auth_user_id, succeeded) values (auth.uid(), false);
        return query select 'invalid_pin'::text, null::uuid;
        return;
      end if;

      -- PIN correcto: reasignar auth_user_id
      update members set auth_user_id = auth.uid() where id = v_member_id;
    else
      -- Miembro antiguo sin PIN: establecer el PIN nuevo y asignar auth_user_id
      update members
         set auth_user_id = auth.uid(),
             pin_hash = coalesce(v_pin_hash, pin_hash)
       where id = v_member_id;
    end if;

    insert into join_attempts (auth_user_id, succeeded) values (auth.uid(), true);
    return query select 'ok'::text, v_community_id;
    return;
  end if;

  -- El miembro no existe: comprobar si este auth_user_id ya tenía otro miembro en esta comunidad
  select id into v_existing_self_id
    from members
   where community_id = v_community_id
     and auth_user_id = auth.uid();

  if v_existing_self_id is not null then
    update members
       set username = trim(p_username),
           pin_hash = coalesce(v_pin_hash, pin_hash)
     where id = v_existing_self_id;
  else
    insert into members (community_id, username, auth_user_id, pin_hash)
    values (v_community_id, trim(p_username), auth.uid(), v_pin_hash);
  end if;

  insert into join_attempts (auth_user_id, succeeded) values (auth.uid(), true);
  return query select 'ok'::text, v_community_id;
end $$;

revoke execute on function create_community(text, text, text) from public, anon;
grant execute on function create_community(text, text, text) to authenticated;

revoke execute on function join_community(text, text, text) from public, anon;
grant execute on function join_community(text, text, text) to authenticated;
