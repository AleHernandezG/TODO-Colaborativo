-- Migration: 20260906180000_recipes_schema.sql
-- Fase 11: Módulo de Recetas Compartidas y volcado a lista de la compra (RF-14)

-- 1. Tabla recipes
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  created_by_member_id uuid references public.members(id) on delete set null,
  title text not null check (char_length(trim(title)) >= 2),
  servings integer not null default 4 check (servings > 0 and servings <= 100),
  instructions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Tabla recipe_ingredients
create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 1),
  quantity numeric not null default 1 check (quantity > 0),
  unit text null,
  catalog_product_id uuid references public.catalog_products(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Índices de búsqueda y relaciones
create index if not exists idx_recipes_community_id on public.recipes(community_id);
create index if not exists idx_recipe_ingredients_recipe_id on public.recipe_ingredients(recipe_id);
create index if not exists idx_recipe_ingredients_catalog_product on public.recipe_ingredients(catalog_product_id);

-- 3. Habilitar RLS
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

-- Políticas RLS para recipes
drop policy if exists "recipes_select" on public.recipes;
create policy "recipes_select" on public.recipes for select
  using (community_id in (select member_community_ids()));

drop policy if exists "recipes_insert" on public.recipes;
create policy "recipes_insert" on public.recipes for insert
  with check (community_id in (select member_community_ids()));

drop policy if exists "recipes_update" on public.recipes;
create policy "recipes_update" on public.recipes for update
  using (community_id in (select member_community_ids()))
  with check (community_id in (select member_community_ids()));

drop policy if exists "recipes_delete" on public.recipes;
create policy "recipes_delete" on public.recipes for delete
  using (community_id in (select member_community_ids()));

-- Políticas RLS para recipe_ingredients
drop policy if exists "recipe_ingredients_select" on public.recipe_ingredients;
create policy "recipe_ingredients_select" on public.recipe_ingredients for select
  using (
    recipe_id in (
      select id from public.recipes where community_id in (select member_community_ids())
    )
  );

drop policy if exists "recipe_ingredients_insert" on public.recipe_ingredients;
create policy "recipe_ingredients_insert" on public.recipe_ingredients for insert
  with check (
    recipe_id in (
      select id from public.recipes where community_id in (select member_community_ids())
    )
  );

drop policy if exists "recipe_ingredients_update" on public.recipe_ingredients;
create policy "recipe_ingredients_update" on public.recipe_ingredients for update
  using (
    recipe_id in (
      select id from public.recipes where community_id in (select member_community_ids())
    )
  )
  with check (
    recipe_id in (
      select id from public.recipes where community_id in (select member_community_ids())
    )
  );

drop policy if exists "recipe_ingredients_delete" on public.recipe_ingredients;
create policy "recipe_ingredients_delete" on public.recipe_ingredients for delete
  using (
    recipe_id in (
      select id from public.recipes where community_id in (select member_community_ids())
    )
  );

-- 4. Soporte para Realtime y Replica Identity Full
alter table public.recipes replica identity full;
alter table public.recipe_ingredients replica identity full;

alter publication supabase_realtime add table public.recipes;
alter publication supabase_realtime add table public.recipe_ingredients;

-- 5. RPC Atómico: save_recipe (Creación / Edición)
create or replace function public.save_recipe(
  p_id uuid,
  p_community_id uuid,
  p_title text,
  p_servings integer,
  p_instructions text,
  p_ingredients jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe_id uuid := p_id;
  v_member_id uuid;
  v_ing jsonb;
  v_index int := 0;
begin
  -- 1. Verificar pertenencia del usuario a la comunidad
  select id into v_member_id
    from members
   where auth_user_id = auth.uid()
     and community_id = p_community_id;

  if v_member_id is null then
    raise exception 'forbidden: not a member of community %', p_community_id;
  end if;

  if trim(p_title) = '' or char_length(trim(p_title)) < 2 then
    raise exception 'invalid_recipe_title';
  end if;

  if p_servings < 1 or p_servings > 100 then
    raise exception 'invalid_recipe_servings';
  end if;

  if v_recipe_id is null then
    v_recipe_id := gen_random_uuid();
  end if;

  -- 2. Insertar o actualizar la cabecera de la receta
  insert into public.recipes (
    id,
    community_id,
    created_by_member_id,
    title,
    servings,
    instructions,
    updated_at
  ) values (
    v_recipe_id,
    p_community_id,
    v_member_id,
    trim(p_title),
    p_servings,
    coalesce(trim(p_instructions), ''),
    now()
  )
  on conflict (id) do update set
    title = excluded.title,
    servings = excluded.servings,
    instructions = excluded.instructions,
    updated_at = now();

  -- 3. Reemplazar ingredientes de la receta
  delete from public.recipe_ingredients where recipe_id = v_recipe_id;

  if p_ingredients is not null and jsonb_array_length(p_ingredients) > 0 then
    for v_ing in select * from jsonb_array_elements(p_ingredients)
    loop
      insert into public.recipe_ingredients (
        id,
        recipe_id,
        name,
        quantity,
        unit,
        catalog_product_id,
        sort_order
      ) values (
        coalesce((v_ing->>'id')::uuid, gen_random_uuid()),
        v_recipe_id,
        trim(v_ing->>'name'),
        coalesce((v_ing->>'quantity')::numeric, 1),
        nullif(trim(v_ing->>'unit'), ''),
        nullif(trim(v_ing->>'catalog_product_id'), '')::uuid,
        coalesce((v_ing->>'sort_order')::integer, v_index)
      );
      v_index := v_index + 1;
    end loop;
  end if;

  return v_recipe_id;
end;
$$;

-- 6. RPC: delete_recipe
create or replace function public.delete_recipe(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_community_id uuid;
begin
  select community_id into v_community_id
    from public.recipes
   where id = p_id;

  if v_community_id is null then
    return;
  end if;

  if not exists (
    select 1 from members
     where auth_user_id = auth.uid()
       and community_id = v_community_id
  ) then
    raise exception 'forbidden: not a member of recipe community';
  end if;

  delete from public.recipes where id = p_id;
end;
$$;
