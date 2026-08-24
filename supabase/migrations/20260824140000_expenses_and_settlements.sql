-- ADR-0005: Reparto de gastos y liquidaciones

-- 1. Tabla de gastos
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  paid_by_member_id uuid not null references members(id) on delete restrict,
  created_by_auth_user_id uuid not null default auth.uid(),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'EUR',
  description text not null check (trim(description) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Tabla puente de cuotas por participante
create table if not exists expense_shares (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  member_id uuid not null references members(id) on delete restrict,
  share_cents integer not null check (share_cents > 0),
  created_at timestamptz not null default now(),
  unique (expense_id, member_id)
);

-- 3. Tabla de liquidaciones directas entre miembros
create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  from_member_id uuid not null references members(id) on delete restrict,
  to_member_id uuid not null references members(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'EUR',
  created_by_auth_user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  check (from_member_id <> to_member_id)
);

-- Índices para claves foráneas y consultas frecuentes
create index if not exists idx_expenses_community_id on expenses(community_id);
create index if not exists idx_expenses_item_id on expenses(item_id);
create index if not exists idx_expenses_paid_by on expenses(paid_by_member_id);
create index if not exists idx_expense_shares_expense_id on expense_shares(expense_id);
create index if not exists idx_expense_shares_member_id on expense_shares(member_id);
create index if not exists idx_settlements_community_id on settlements(community_id);
create index if not exists idx_settlements_from_member on settlements(from_member_id);
create index if not exists idx_settlements_to_member on settlements(to_member_id);

-- RLS
alter table expenses enable row level security;
alter table expense_shares enable row level security;
alter table settlements enable row level security;

-- Políticas para expenses
create policy "expenses_select"
  on expenses for select
  using (community_id in (select member_community_ids()));

create policy "expenses_insert"
  on expenses for insert
  with check (
    community_id in (select member_community_ids())
    and created_by_auth_user_id = auth.uid()
  );

create policy "expenses_update"
  on expenses for update
  using (
    community_id in (select member_community_ids())
    and created_by_auth_user_id = auth.uid()
  )
  with check (
    community_id in (select member_community_ids())
    and created_by_auth_user_id = auth.uid()
  );

create policy "expenses_delete"
  on expenses for delete
  using (
    community_id in (select member_community_ids())
    and created_by_auth_user_id = auth.uid()
  );

-- Políticas para expense_shares
create policy "expense_shares_select"
  on expense_shares for select
  using (
    exists (
      select 1 from expenses e
      where e.id = expense_shares.expense_id
        and e.community_id in (select member_community_ids())
    )
  );

create policy "expense_shares_insert"
  on expense_shares for insert
  with check (
    exists (
      select 1 from expenses e
      where e.id = expense_shares.expense_id
        and e.community_id in (select member_community_ids())
        and e.created_by_auth_user_id = auth.uid()
    )
  );

create policy "expense_shares_delete"
  on expense_shares for delete
  using (
    exists (
      select 1 from expenses e
      where e.id = expense_shares.expense_id
        and e.created_by_auth_user_id = auth.uid()
    )
  );

-- Políticas para settlements
create policy "settlements_select"
  on settlements for select
  using (community_id in (select member_community_ids()));

create policy "settlements_insert"
  on settlements for insert
  with check (
    community_id in (select member_community_ids())
    and created_by_auth_user_id = auth.uid()
  );

create policy "settlements_delete"
  on settlements for delete
  using (
    community_id in (select member_community_ids())
    and created_by_auth_user_id = auth.uid()
  );

-- RPC atómica para crear un gasto con sus cuotas validadas
create or replace function create_expense_with_shares(
  p_community_id uuid,
  p_item_id uuid,
  p_paid_by_member_id uuid,
  p_amount_cents integer,
  p_description text,
  p_shares jsonb
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

  -- Validar que la suma de las cuotas coincide exactamente con el total
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
    community_id,
    item_id,
    paid_by_member_id,
    created_by_auth_user_id,
    amount_cents,
    description
  )
  values (
    p_community_id,
    p_item_id,
    p_paid_by_member_id,
    auth.uid(),
    p_amount_cents,
    trim(p_description)
  )
  returning id into v_expense_id;

  insert into expense_shares (expense_id, member_id, share_cents)
  select v_expense_id, member_id, share_cents
  from jsonb_to_recordset(p_shares) as x(member_id uuid, share_cents integer);

  return v_expense_id;
end $$;

revoke execute on function create_expense_with_shares(uuid, uuid, uuid, integer, text, jsonb) from public, anon;
grant execute on function create_expense_with_shares(uuid, uuid, uuid, integer, text, jsonb) to authenticated;
