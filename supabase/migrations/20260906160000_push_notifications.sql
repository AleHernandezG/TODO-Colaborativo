-- Fase 10: Notificaciones Push Colaborativas
-- Almacenamiento de tokens Expo Push por miembro con RLS y RPCs de gestión y consulta segura.

create table member_push_tokens (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  expo_push_token text not null check (char_length(expo_push_token) between 10 and 200),
  device_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, expo_push_token)
);

create index idx_member_push_tokens_member on member_push_tokens (member_id);

alter table member_push_tokens enable row level security;

-- Políticas RLS
create policy "member can view their push tokens"
on member_push_tokens
for select
using (
  member_id in (
    select id from members
    where auth_user_id = auth.uid()
      and removed_at is null
  )
);

create policy "member can insert their push tokens"
on member_push_tokens
for insert
with check (
  member_id in (
    select id from members
    where auth_user_id = auth.uid()
      and removed_at is null
  )
);

create policy "member can update their push tokens"
on member_push_tokens
for update
using (
  member_id in (
    select id from members
    where auth_user_id = auth.uid()
      and removed_at is null
  )
);

create policy "member can delete their push tokens"
on member_push_tokens
for delete
using (
  member_id in (
    select id from members
    where auth_user_id = auth.uid()
      and removed_at is null
  )
);

create trigger touch_member_push_tokens_updated_at
before update on member_push_tokens
for each row
execute function touch_updated_at();

-- RPC: Registrar o actualizar token Expo Push de forma idempotente
create or replace function register_push_token(
  p_community_id uuid,
  p_expo_push_token text,
  p_device_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  select id into v_member_id
  from members
  where community_id = p_community_id
    and auth_user_id = auth.uid()
    and removed_at is null
  limit 1;

  if v_member_id is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  insert into member_push_tokens (member_id, expo_push_token, device_name, updated_at)
  values (v_member_id, p_expo_push_token, p_device_name, now())
  on conflict (member_id, expo_push_token)
  do update set
    device_name = coalesce(excluded.device_name, member_push_tokens.device_name),
    updated_at = now();
end;
$$;

-- RPC: Desregistrar token al cerrar sesión o desactivar
create or replace function unregister_push_token(
  p_expo_push_token text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id uuid := auth.uid();
begin
  if v_auth_id is null then
    return;
  end if;

  delete from member_push_tokens
  where expo_push_token = p_expo_push_token
    and member_id in (
      select id from members where auth_user_id = v_auth_id
    );
end;
$$;

-- RPC: Obtener tokens de los DEMÁS miembros activos de la comunidad para enviar notificaciones
create or replace function get_community_push_tokens(
  p_community_id uuid
)
returns table (
  expo_push_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_member_id uuid;
begin
  select id into v_current_member_id
  from members
  where community_id = p_community_id
    and auth_user_id = auth.uid()
    and removed_at is null
  limit 1;

  if v_current_member_id is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  return query
  select distinct mpt.expo_push_token
  from member_push_tokens mpt
  join members m on m.id = mpt.member_id
  where m.community_id = p_community_id
    and m.id != v_current_member_id
    and m.removed_at is null
    and mpt.expo_push_token is not null
    and mpt.expo_push_token != '';
end;
$$;
