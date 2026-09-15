-- Keeps a completed Kitchen Check hidden for one day, across devices.
alter table public.kitchen_items
  add column if not exists last_checked_at timestamptz;
