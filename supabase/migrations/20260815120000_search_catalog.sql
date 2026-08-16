create or replace function search_catalog(
  p_query          text,
  p_supermarket_id text default null,
  p_limit          int  default 50
)
returns table (
  id uuid, supermarket_id text, name text, normalized_name text,
  brand text, package_size text, image_url text,
  price_cents int, currency text, price_checked_at timestamptz,
  similarity real
)
language sql stable parallel safe security invoker
set search_path = public, extensions
as $$
  with scored as materialized (
    select c.id, c.supermarket_id, c.name, c.normalized_name,
           c.brand, c.package_size, c.image_url,
           c.price_cents, c.currency::text as currency, c.price_checked_at,
           word_similarity(trim(p_query), c.normalized_name) as similarity
    from catalog_products c
    where length(trim(p_query)) > 0
      and (p_supermarket_id is null or c.supermarket_id = p_supermarket_id)
  )
  select s.id, s.supermarket_id, s.name, s.normalized_name,
         s.brand, s.package_size, s.image_url,
         s.price_cents, s.currency, s.price_checked_at, s.similarity
  from scored s
  where s.similarity >= 0.5
  order by s.similarity desc, s.name
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

revoke execute on function search_catalog(text, text, int) from public, anon;
grant  execute on function search_catalog(text, text, int) to authenticated;
