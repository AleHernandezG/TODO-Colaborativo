-- Sobrecargas de dos argumentos que dejó viva 20260824130000_member_pin.sql: un
-- `create or replace` que añade un parámetro crea otra función, no reemplaza la anterior.
-- Con las dos presentes PostgREST devuelve PGRST203 a cualquier cliente que no mande p_pin.

drop function if exists public.join_community(text, text);
drop function if exists public.create_community(text, text);
