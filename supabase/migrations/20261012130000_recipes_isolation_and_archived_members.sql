-- Incremento 4 de docs/auditoria-2026-10-11.md (fallos 3, 12 y 24).
--
-- 1. save_recipe dejaba sobrescribir la receta de otra comunidad sabiendo su uuid.
-- 2. Un miembro archivado (removed_at) seguía pudiendo crear gastos y crear, editar o borrar
--    recetas: tres RPC comprobaban la pertenencia sin mirar removed_at.
-- 3. create_expense_with_shares y upsert_meal_slot aceptaban ids de otra comunidad.
-- 4. Siete funciones security definer no tenían revoke/grant.
-- 5. recipe_ingredients estaba en la publicación de Realtime sin community_id por el que filtrar.
-- 6. Lo que esas RPC validan se podía saltar escribiendo directo en expenses, expense_shares,
--    meal_plan_slots y settlements, porque tenían políticas de insert y update.
--
-- Ninguna firma cambia. No aplicar al proyecto real sin ensayarla antes:
-- docs/guias/ensayar-una-migracion.md

-- ---------------------------------------------------------------------------------------------
-- 1. save_recipe: misma firma
-- ---------------------------------------------------------------------------------------------

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
  v_saved_id uuid;
  v_member_id uuid;
  v_ing jsonb;
  v_index int := 0;
begin
  select m.id into v_member_id
    from members m
   where m.auth_user_id = auth.uid()
     and m.community_id = p_community_id
     and m.removed_at is null;

  if v_member_id is null then
    raise exception 'forbidden: not a member of community %', p_community_id
      using errcode = '42501';
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

  -- El `where` del `do update` es lo que faltaba: sin él, un id que ya existe en OTRA comunidad
  -- se actualizaba igual, porque la pertenencia solo se comprobaba contra p_community_id.
  insert into public.recipes as r (
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
    updated_at = now()
  where r.community_id = excluded.community_id
  returning r.id into v_saved_id;

  -- Sin fila devuelta: el id existe y es de otra comunidad. No se toca nada, tampoco sus
  -- ingredientes.
  if v_saved_id is null then
    raise exception 'forbidden: recipe belongs to another community' using errcode = '42501';
  end if;

  delete from public.recipe_ingredients ri where ri.recipe_id = v_recipe_id;

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

-- ---------------------------------------------------------------------------------------------
-- 2. delete_recipe: misma firma. Solo un miembro activo.
-- ---------------------------------------------------------------------------------------------

create or replace function public.delete_recipe(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_community_id uuid;
begin
  select r.community_id into v_community_id
    from public.recipes r
   where r.id = p_id;

  if v_community_id is null then
    return;
  end if;

  if not exists (
    select 1 from members m
     where m.auth_user_id = auth.uid()
       and m.community_id = v_community_id
       and m.removed_at is null
  ) then
    raise exception 'forbidden: not a member of recipe community' using errcode = '42501';
  end if;

  delete from public.recipes r where r.id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. create_expense_with_shares: misma firma. Solo un miembro activo, y quien paga y quienes
--    reparten tienen que ser miembros de esa misma comunidad.
-- ---------------------------------------------------------------------------------------------

create or replace function create_expense_with_shares(
  p_community_id uuid,
  p_item_id uuid,
  p_paid_by_member_id uuid,
  p_amount_cents integer,
  p_description text,
  p_shares jsonb,
  p_expense_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_expense_id uuid;
  v_share_total integer := 0;
  v_share record;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from members m
    where m.community_id = p_community_id
      and m.auth_user_id = auth.uid()
      and m.removed_at is null
  ) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  if p_amount_cents <= 0 then
    raise exception 'invalid_amount' using errcode = '22003';
  end if;

  for v_share in select * from jsonb_to_recordset(p_shares) as x(member_id uuid, share_cents integer)
  loop
    if v_share.share_cents <= 0 then
      raise exception 'invalid_share_amount' using errcode = '22003';
    end if;
    v_share_total := v_share_total + v_share.share_cents;
  end loop;

  if v_share_total <> p_amount_cents then
    raise exception 'shares_sum_mismatch: total % != shares %', p_amount_cents, v_share_total using errcode = '23514';
  end if;

  -- Un miembro archivado sí puede figurar: sus gastos antiguos siguen siendo suyos. Lo que no
  -- puede figurar es alguien de otra lista.
  if not exists (
    select 1 from members m
     where m.id = p_paid_by_member_id and m.community_id = p_community_id
  ) or exists (
    select 1
      from jsonb_to_recordset(p_shares) as x(member_id uuid, share_cents integer)
     where not exists (
       select 1 from members m
        where m.id = x.member_id and m.community_id = p_community_id
     )
  ) then
    raise exception 'member_not_in_community' using errcode = '23503';
  end if;

  if p_item_id is not null and not exists (
    select 1 from items i where i.id = p_item_id and i.community_id = p_community_id
  ) then
    raise exception 'item_not_in_community' using errcode = '23503';
  end if;

  insert into expenses (
    id,
    community_id,
    item_id,
    paid_by_member_id,
    created_by_auth_user_id,
    amount_cents,
    description
  )
  values (
    coalesce(p_expense_id, gen_random_uuid()),
    p_community_id,
    p_item_id,
    p_paid_by_member_id,
    auth.uid(),
    p_amount_cents,
    trim(p_description)
  )
  on conflict (id) do nothing
  returning id into v_expense_id;

  if v_expense_id is null then
    return p_expense_id;
  end if;

  insert into expense_shares (expense_id, member_id, share_cents)
  select v_expense_id, x.member_id, x.share_cents
  from jsonb_to_recordset(p_shares) as x(member_id uuid, share_cents integer);

  return v_expense_id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4. upsert_meal_slot: misma firma. La receta del hueco tiene que ser de la misma comunidad.
-- ---------------------------------------------------------------------------------------------

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

  if p_recipe_id is not null and not exists (
    select 1 from public.recipes r
     where r.id = p_recipe_id and r.community_id = p_community_id
  ) then
    raise exception 'recipe_not_in_community' using errcode = '23503';
  end if;

  select current_member_id(p_community_id) into v_current_member_id;

  insert into public.meal_plan_slots as s (
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
  returning s.id into v_slot_id;

  return v_slot_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. recipe_ingredients sale de Realtime. No tiene community_id por el que filtrar, así que un
--    canal sobre ella recibiría los borrados de todas las comunidades. El cliente no la escucha:
--    save_recipe actualiza recipes.updated_at y ese evento ya avisa de todo lo que cambió.
--    Es el mismo criterio que expense_shares (20260828140000).
-- ---------------------------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'recipe_ingredients'
  ) then
    alter publication supabase_realtime drop table public.recipe_ingredients;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Permisos, con la firma exacta. Las siete de las fases 10 a 12 no los tenían.
-- ---------------------------------------------------------------------------------------------

revoke execute on function register_push_token(uuid, text, text)                              from public, anon;
revoke execute on function unregister_push_token(text)                                        from public, anon;
revoke execute on function get_community_push_tokens(uuid)                                    from public, anon;
revoke execute on function save_recipe(uuid, uuid, text, integer, text, jsonb, text)          from public, anon;
revoke execute on function delete_recipe(uuid)                                                from public, anon;
revoke execute on function upsert_meal_slot(uuid, date, text, uuid, text, integer, text)      from public, anon;
revoke execute on function delete_meal_slot(uuid, date, text)                                 from public, anon;
revoke execute on function create_expense_with_shares(uuid, uuid, uuid, integer, text, jsonb, uuid) from public, anon;

grant execute on function register_push_token(uuid, text, text)                               to authenticated;
grant execute on function unregister_push_token(text)                                         to authenticated;
grant execute on function get_community_push_tokens(uuid)                                     to authenticated;
grant execute on function save_recipe(uuid, uuid, text, integer, text, jsonb, text)           to authenticated;
grant execute on function delete_recipe(uuid)                                                 to authenticated;
grant execute on function upsert_meal_slot(uuid, date, text, uuid, text, integer, text)       to authenticated;
grant execute on function delete_meal_slot(uuid, date, text)                                  to authenticated;
grant execute on function create_expense_with_shares(uuid, uuid, uuid, integer, text, jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7. Lo que la RPC valida, que no se pueda saltar escribiendo directo en la tabla.
--    Decidido por el usuario el 2026-10-12 (docs/phases/fase-15.md, apartado 10).
--
--    Ningún cliente inserta ni actualiza directamente en expenses, expense_shares ni
--    meal_plan_slots: la app actual y el JS de la runtime 1.2.0 (commit f7349b3) lo hacen por
--    create_expense_with_shares y upsert_meal_slot. Sí borran directo, y esas políticas se quedan.
--    Las RPC son security definer y no dependen de estas políticas.
-- ---------------------------------------------------------------------------------------------

drop policy if exists "expenses_insert" on expenses;
drop policy if exists "expenses_update" on expenses;

-- Las cuotas nacen con su gasto y mueren con él, en cascada. Insertar o borrar una suelta rompe
-- la invariante de que suman el importe, que solo comprueba la RPC.
drop policy if exists "expense_shares_insert" on expense_shares;
drop policy if exists "expense_shares_delete" on expense_shares;

drop policy if exists "Members can insert community meal plan slots" on public.meal_plan_slots;
drop policy if exists "Members can update community meal plan slots" on public.meal_plan_slots;

-- settlements es distinto: los clientes instalados SÍ insertan directo, así que la política no
-- se puede quitar sin romperlos. Se endurece: las dos personas tienen que ser de esa comunidad.
-- El `exists` sobre members pasa por su propia RLS, que deja ver a todos los miembros de las
-- comunidades de quien llama, archivados e invitados incluidos.
drop policy if exists "settlements_insert" on settlements;
create policy "settlements_insert"
  on settlements for insert
  with check (
    community_id in (select member_community_ids())
    and created_by_auth_user_id = auth.uid()
    and exists (
      select 1 from members m
       where m.id = settlements.from_member_id
         and m.community_id = settlements.community_id
    )
    and exists (
      select 1 from members m
       where m.id = settlements.to_member_id
         and m.community_id = settlements.community_id
    )
  );
