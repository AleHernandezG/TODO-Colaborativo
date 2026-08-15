create extension if not exists pg_trgm with schema extensions;

create table supermarkets (
  id       text primary key,
  name     text not null check (char_length(trim(name)) between 1 and 60),
  country  char(2) not null
);

insert into supermarkets (id, name, country) values ('mercadona', 'Mercadona', 'ES');

create table catalog_products (
  id               uuid primary key default gen_random_uuid(),
  supermarket_id   text not null references supermarkets(id) on delete cascade,
  external_id      text not null,
  name             text not null check (char_length(trim(name)) between 1 and 200),
  normalized_name  text not null check (char_length(normalized_name) between 1 and 200),
  brand            text,
  package_size     text,
  barcode          text,
  image_url        text,
  price_cents      int check (price_cents >= 0),
  currency         char(3) not null default 'EUR',
  price_checked_at timestamptz,
  updated_at       timestamptz not null default now(),
  unique (supermarket_id, external_id),
  check (price_cents is null or price_checked_at is not null)
);

create index on catalog_products (supermarket_id);
create index on catalog_products using gin (normalized_name extensions.gin_trgm_ops);
create index on catalog_products (barcode) where barcode is not null;

create trigger catalog_products_touch_updated_at
  before update on catalog_products
  for each row execute function touch_updated_at();

alter table items add column catalog_product_id uuid references catalog_products(id) on delete set null;
create index on items (catalog_product_id) where catalog_product_id is not null;

alter table supermarkets      enable row level security;
alter table catalog_products  enable row level security;

create policy supermarkets_select     on supermarkets     for select to authenticated using (true);
create policy catalog_products_select on catalog_products for select to authenticated using (true);
