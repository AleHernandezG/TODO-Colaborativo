create or replace function public.ping()
returns text
language sql
stable
set search_path = public as $$
  select 'pong'::text;
$$;

revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
