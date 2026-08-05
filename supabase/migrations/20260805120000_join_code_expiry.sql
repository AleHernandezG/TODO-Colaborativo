create or replace function join_code_lifetime()
returns interval
language sql immutable as $$ select interval '7 days' $$;

alter table communities
  add column join_code_expires_at timestamptz not null default now() + join_code_lifetime();

create or replace function join_community(p_join_code text, p_username text)
returns table (status text, community_id uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_community_id uuid;
  v_expires_at timestamptz;
  v_failed_attempts int;
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

  begin
    insert into members (community_id, username, auth_user_id)
    values (v_community_id, trim(p_username), auth.uid())
    on conflict (community_id, auth_user_id) do update set username = excluded.username;
  exception when unique_violation then
    insert into join_attempts (auth_user_id, succeeded) values (auth.uid(), false);
    return query select 'username_taken'::text, null::uuid;
    return;
  end;

  insert into join_attempts (auth_user_id, succeeded) values (auth.uid(), true);
  return query select 'ok'::text, v_community_id;
end $$;

create or replace function rotate_join_code(p_community_id uuid)
returns table (join_code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_code text;
  v_expires_at timestamptz;
begin
  if p_community_id not in (select member_community_ids()) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;

  v_code := generate_join_code();
  v_expires_at := now() + join_code_lifetime();

  update communities
     set join_code = v_code,
         join_code_expires_at = v_expires_at
   where id = p_community_id;

  return query select v_code, v_expires_at;
end $$;

revoke execute on function join_code_lifetime()          from public, anon;
revoke execute on function rotate_join_code(uuid)        from public, anon;
revoke execute on function join_community(text, text)    from public, anon;

grant execute on function rotate_join_code(uuid)      to authenticated;
grant execute on function join_community(text, text)  to authenticated;
