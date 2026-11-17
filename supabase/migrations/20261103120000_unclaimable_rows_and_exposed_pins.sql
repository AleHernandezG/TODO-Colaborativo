do $$
begin
  perform set_config('lock_timeout', '5s', true);
  lock table public.member_secrets in exclusive mode;
end $$;

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

    if v_member_pin_hash is null
       and not v_is_owner
       and (v_member_auth_user_id is not null or v_pin is null) then
      insert into join_attempts (auth_user_id, succeeded) values (v_uid, false);
      return query
        select (case when v_pin is null then 'username_taken' else 'invalid_pin' end)::text,
               null::uuid;
      return;
    end if;

    if not v_is_owner then
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
  update member_secrets s set exposed = true where s.member_id = p_member_id;

  delete from member_push_tokens t where t.member_id = p_member_id;
  update join_attempts a set member_id = null where a.member_id = p_member_id;

  update members m
     set auth_user_id = null,
         is_admin = false
   where m.id = p_member_id;

  return query select v_temp_pin;
end $$;

delete from member_secrets s
 using members m
 where m.id = s.member_id
   and s.exposed
   and m.auth_user_id is not null;

update member_secrets s
   set exposed = true
  from members m
 where m.id = s.member_id
   and m.auth_user_id is null
   and m.removed_at is null
   and not s.exposed;

comment on column member_secrets.exposed is
  'El PIN lo conoce alguien más que su dueño: vino de members.pin_hash (ADR-0026) o lo generó un admin con reset_member_pin (ADR-0029). store_member_pin lo devuelve a false.';

comment on function my_member_pin_state(uuid) is
  'none, exposed (el PIN lo conoce alguien más: ver member_secrets.exposed) o set.';

comment on function join_community(text, text, text) is
  'Una fila sin PIN solo la reclama su dueño. Otra sesión recibe invalid_pin si manda PIN y username_taken si no; un invitado sin PIN se adopta solo con PIN (ADR-0029).';

revoke execute on function generate_join_code() from public, anon, authenticated;
revoke execute on function join_code_lifetime() from public, anon, authenticated;
