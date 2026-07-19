create table communities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 60),
  join_code   text not null unique,
  created_at  timestamptz not null default now()
);

create table members (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references communities(id) on delete cascade,
  username      text not null check (char_length(trim(username)) between 1 and 40),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (community_id, username),
  unique (community_id, auth_user_id)
);

create table items (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references communities(id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 1 and 120),
  quantity      int not null default 1 check (quantity >= 1),
  image_url     text,
  is_purchased  boolean not null default false,
  created_by    uuid references members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on items (community_id, is_purchased);
create index on members (community_id);
create index on members (auth_user_id);

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger items_touch_updated_at
  before update on items
  for each row execute function touch_updated_at();

alter publication supabase_realtime add table items;
