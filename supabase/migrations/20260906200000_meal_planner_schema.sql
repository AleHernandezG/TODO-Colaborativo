-- Migración Fase 12: Planificador Semanal de Menús (Meal Planner) (RF-15)

create table if not exists public.meal_plan_slots (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('lunch', 'dinner')),
  recipe_id uuid references public.recipes(id) on delete set null,
  custom_dish_name text,
  servings integer not null default 4 check (servings between 1 and 100),
  notes text,
  created_by_member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_plan_slot_unique unique (community_id, date, meal_type)
);

create index if not exists idx_meal_plan_slots_comm_date
  on public.meal_plan_slots (community_id, date);

create index if not exists idx_meal_plan_slots_recipe
  on public.meal_plan_slots (recipe_id);

alter table public.meal_plan_slots enable row level security;

-- Políticas RLS para meal_plan_slots vinculadas a miembros de la comunidad activa
drop policy if exists "Members can read community meal plan slots" on public.meal_plan_slots;
create policy "Members can read community meal plan slots"
  on public.meal_plan_slots for select
  using (community_id in (select member_community_ids()));

drop policy if exists "Members can insert community meal plan slots" on public.meal_plan_slots;
create policy "Members can insert community meal plan slots"
  on public.meal_plan_slots for insert
  with check (community_id in (select member_community_ids()));

drop policy if exists "Members can update community meal plan slots" on public.meal_plan_slots;
create policy "Members can update community meal plan slots"
  on public.meal_plan_slots for update
  using (community_id in (select member_community_ids()))
  with check (community_id in (select member_community_ids()));

drop policy if exists "Members can delete community meal plan slots" on public.meal_plan_slots;
create policy "Members can delete community meal plan slots"
  on public.meal_plan_slots for delete
  using (community_id in (select member_community_ids()));

-- Realtime para sincronizar cambios en el menú semanal
alter table public.meal_plan_slots replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meal_plan_slots'
  ) then
    alter publication supabase_realtime add table public.meal_plan_slots;
  end if;
end;
$$;

-- Procedimiento almacenado para guardar/actualizar un slot del menú semanal
create or replace function public.upsert_meal_slot(
  p_community_id uuid,
  p_date date,
  p_meal_type text,
  p_recipe_id uuid default null,
  p_custom_dish_name text default null,
  p_servings integer default 4,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot_id uuid;
  v_current_member_id uuid;
begin
  if not (p_community_id in (select member_community_ids())) then
    raise exception 'No perteneces a esta comunidad' using errcode = '42501';
  end if;

  if p_meal_type not in ('lunch', 'dinner') then
    raise exception 'Tipo de comida inválido: %', p_meal_type using errcode = '22023';
  end if;

  if p_servings < 1 or p_servings > 100 then
    raise exception 'Comensales fuera de rango (1-100)' using errcode = '22023';
  end if;

  select current_member_id(p_community_id) into v_current_member_id;

  insert into public.meal_plan_slots (
    community_id,
    date,
    meal_type,
    recipe_id,
    custom_dish_name,
    servings,
    notes,
    created_by_member_id,
    updated_at
  )
  values (
    p_community_id,
    p_date,
    p_meal_type,
    p_recipe_id,
    nullif(trim(p_custom_dish_name), ''),
    p_servings,
    nullif(trim(p_notes), ''),
    v_current_member_id,
    now()
  )
  on conflict (community_id, date, meal_type)
  do update set
    recipe_id = excluded.recipe_id,
    custom_dish_name = excluded.custom_dish_name,
    servings = excluded.servings,
    notes = excluded.notes,
    updated_at = now()
  returning id into v_slot_id;

  return v_slot_id;
end;
$$;

-- Procedimiento para eliminar un slot
create or replace function public.delete_meal_slot(
  p_community_id uuid,
  p_date date,
  p_meal_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (p_community_id in (select member_community_ids())) then
    raise exception 'No perteneces a esta comunidad' using errcode = '42501';
  end if;

  delete from public.meal_plan_slots
  where community_id = p_community_id
    and date = p_date
    and meal_type = p_meal_type;
end;
$$;
