-- Migration: 20260907180000_item_categories.sql
-- Fase 14: Categorización inteligente de artículos y agrupación por pasillos (RF-16)

-- 1. Añadir columna category a items con valor por defecto 'other'
alter table public.items add column if not exists category text not null default 'other';

-- 2. Restricción de verificación para las 10 categorías estándar
alter table public.items drop constraint if exists items_category_check;
alter table public.items add constraint items_category_check check (
  category in (
    'fruits_vegetables',
    'dairy_eggs',
    'meat_fish',
    'bakery',
    'pantry',
    'drinks',
    'frozen',
    'cleaning_home',
    'personal_care',
    'other'
  )
);

-- 3. Índice para optimizar consultas y agrupaciones por comunidad y categoría
create index if not exists idx_items_community_category on public.items(community_id, category);
