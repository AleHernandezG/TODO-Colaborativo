-- ADR-0010: un gasto se puede crear sin conexión, así que su id lo genera el cliente y viaja en
-- las variables de la mutación encolada. La RPC lo acepta y el alta pasa a ser idempotente: un
-- reenvío de la cola con el mismo id devuelve el gasto que ya está, no crea otro.

-- El drop de la firma anterior va aquí y no en otra migración: un create que añade un parámetro
-- crea otra sobrecarga, y con dos candidatas PostgREST devuelve PGRST203 a todo cliente que no
-- mande el parámetro nuevo. Pasó el 2026-08-24 con p_pin. El default null de p_expense_id deja
-- que las llamadas de seis argumentos del APK instalado sigan resolviendo.
drop function if exists public.create_expense_with_shares(uuid, uuid, uuid, integer, text, jsonb);

create function create_expense_with_shares(
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
    select 1 from members
    where community_id = p_community_id
      and auth_user_id = auth.uid()
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
  select v_expense_id, member_id, share_cents
  from jsonb_to_recordset(p_shares) as x(member_id uuid, share_cents integer);

  return v_expense_id;
end $$;

revoke execute on function create_expense_with_shares(uuid, uuid, uuid, integer, text, jsonb, uuid) from public, anon;
grant execute on function create_expense_with_shares(uuid, uuid, uuid, integer, text, jsonb, uuid) to authenticated;
