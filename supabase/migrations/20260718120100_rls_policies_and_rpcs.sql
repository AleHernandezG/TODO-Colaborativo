alter table communities enable row level security;
alter table members     enable row level security;
alter table items       enable row level security;

create or replace function member_community_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select community_id from members where auth_user_id = auth.uid()
$$;

create or replace function current_member_id(p_community_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select id from members
   where auth_user_id = auth.uid()
     and community_id = p_community_id
$$;

create policy communities_select on communities for select
  using (id in (select member_community_ids()));

create policy members_select on members for select
  using (community_id in (select member_community_ids()));

create policy items_select on items for select
  using (community_id in (select member_community_ids()));

create policy items_insert on items for insert
  with check (
    community_id in (select member_community_ids())
    and (created_by is null or created_by = current_member_id(community_id))
  );

create policy items_update on items for update
  using (community_id in (select member_community_ids()))
  with check (community_id in (select member_community_ids()));

create policy items_delete on items for delete
  using (community_id in (select member_community_ids()));

create or replace function generate_join_code()
returns text
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  attempts int := 0;
begin
  loop
    candidate := '';
    for i in 1..3 loop
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    candidate := candidate || '-';
    for i in 1..4 loop
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;

    exit when not exists (select 1 from communities where join_code = candidate);

    attempts := attempts + 1;
    if attempts > 10 then
      raise exception 'join_code_generation_failed';
    end if;
  end loop;

  return candidate;
end $$;

create or replace function create_community(p_name text, p_username text)
returns table (community_id uuid, join_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  v_code := generate_join_code();

  insert into communities (name, join_code)
  values (trim(p_name), v_code)
  returning id into v_id;

  insert into members (community_id, username, auth_user_id)
  values (v_id, trim(p_username), auth.uid());

  return query select v_id, v_code;
end $$;

create or replace function join_community(p_join_code text, p_username text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_community_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select id into v_community_id
    from communities
   where join_code = upper(trim(p_join_code));

  if v_community_id is null then
    raise exception 'invalid_join_code' using errcode = 'P0001';
  end if;

  insert into members (community_id, username, auth_user_id)
  values (v_community_id, trim(p_username), auth.uid())
  on conflict (community_id, auth_user_id) do update set username = excluded.username;

  return v_community_id;
exception
  when unique_violation then
    raise exception 'username_taken' using errcode = 'P0001';
end $$;

revoke execute on function member_community_ids()            from public, anon;
revoke execute on function current_member_id(uuid)           from public, anon;
revoke execute on function generate_join_code()              from public, anon;
revoke execute on function create_community(text, text)      from public, anon;
revoke execute on function join_community(text, text)        from public, anon;

grant execute on function member_community_ids()       to authenticated;
grant execute on function current_member_id(uuid)      to authenticated;
grant execute on function create_community(text, text) to authenticated;
grant execute on function join_community(text, text)   to authenticated;
