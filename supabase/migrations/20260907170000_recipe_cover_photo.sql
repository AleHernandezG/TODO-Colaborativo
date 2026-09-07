-- Migration: 20260907170000_recipe_cover_photo.sql
-- Fase 13: Foto opcional en alta de artículos y foto de portada en recetas

-- 1. Añadir columna image_path a la tabla recipes
alter table public.recipes add column if not exists image_path text null;

-- 2. Bucket de Storage recipe-images para portadas de recetas
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', false, 2097152, array['image/jpeg'])
on conflict (id) do update set
  public            = excluded.public,
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Políticas RLS para storage.objects en el bucket recipe-images
drop policy if exists "recipe_images_select" on storage.objects;
create policy "recipe_images_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] in (
      select c.community_id::text from public.member_community_ids() as c(community_id)
    )
  );

drop policy if exists "recipe_images_insert" on storage.objects;
create policy "recipe_images_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] in (
      select c.community_id::text from public.member_community_ids() as c(community_id)
    )
  );

drop policy if exists "recipe_images_update" on storage.objects;
create policy "recipe_images_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] in (
      select c.community_id::text from public.member_community_ids() as c(community_id)
    )
  )
  with check (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] in (
      select c.community_id::text from public.member_community_ids() as c(community_id)
    )
  );

drop policy if exists "recipe_images_delete" on storage.objects;
create policy "recipe_images_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] in (
      select c.community_id::text from public.member_community_ids() as c(community_id)
    )
  );

-- 3. Eliminar la firma anterior de save_recipe para evitar error PGRST203 por sobrecarga en PostgREST
drop function if exists public.save_recipe(uuid, uuid, text, integer, text, jsonb);

-- 4. Recrear save_recipe con p_image_path opcional
create or replace function public.save_recipe(
  p_id uuid,
  p_community_id uuid,
  p_title text,
  p_servings integer,
  p_instructions text,
  p_ingredients jsonb,
  p_image_path text default null
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
  -- Verificar pertenencia del usuario a la comunidad
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

  -- Insertar o actualizar la cabecera de la receta
  insert into public.recipes (
    id,
    community_id,
    created_by_member_id,
    title,
    servings,
    instructions,
    image_path,
    updated_at
  ) values (
    v_recipe_id,
    p_community_id,
    v_member_id,
    trim(p_title),
    p_servings,
    coalesce(trim(p_instructions), ''),
    p_image_path,
    now()
  )
  on conflict (id) do update set
    title = excluded.title,
    servings = excluded.servings,
    instructions = excluded.instructions,
    image_path = excluded.image_path,
    updated_at = now();

  -- Reemplazar ingredientes de la receta
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
