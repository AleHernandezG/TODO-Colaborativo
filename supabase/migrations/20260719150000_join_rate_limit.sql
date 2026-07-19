create table join_attempts (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  succeeded     boolean not null default false,
  attempted_at  timestamptz not null default now()
);

create index on join_attempts (auth_user_id, attempted_at desc);

alter table join_attempts enable row level security;

drop function if exists join_community(text, text);

create or replace function join_community(p_join_code text, p_username text)
returns table (status text, community_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_community_id uuid;
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

  select id into v_community_id
    from communities
   where join_code = upper(trim(p_join_code));

  if v_community_id is null then
    insert into join_attempts (auth_user_id, succeeded) values (auth.uid(), false);
    return query select 'invalid_join_code'::text, null::uuid;
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

revoke execute on function join_community(text, text) from public, anon;
grant execute on function join_community(text, text) to authenticated;
