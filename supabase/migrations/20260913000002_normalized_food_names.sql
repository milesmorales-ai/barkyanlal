alter table public.kitchen_items
  add column if not exists normalized_name text;

update public.kitchen_items
set normalized_name = name
where normalized_name is null;
