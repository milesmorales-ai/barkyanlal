create table if not exists public.notification_dismissals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dismissed_date date not null,
  created_at timestamptz not null default now()
);

alter table public.notification_dismissals enable row level security;

drop policy if exists "Users can manage their notification dismissals" on public.notification_dismissals;
create policy "Users can manage their notification dismissals"
  on public.notification_dismissals for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
