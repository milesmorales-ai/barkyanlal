-- One shared set of AI recipe suggestions per family. A refresh by any member
-- replaces this row, so the whole pantry reuses a single AI response.
create table if not exists public.family_recipe_cache (
  family_id uuid primary key references public.families(id) on delete cascade,
  recipes jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.family_recipe_cache enable row level security;

drop policy if exists "Family members can read shared recipes" on public.family_recipe_cache;
create policy "Family members can read shared recipes"
  on public.family_recipe_cache for select
  using (public.is_family_member(family_id));

drop policy if exists "Family members can add shared recipes" on public.family_recipe_cache;
create policy "Family members can add shared recipes"
  on public.family_recipe_cache for insert
  with check (
    public.is_family_member(family_id)
    and updated_by = (select auth.uid())
  );

drop policy if exists "Family members can refresh shared recipes" on public.family_recipe_cache;
create policy "Family members can refresh shared recipes"
  on public.family_recipe_cache for update
  using (public.is_family_member(family_id))
  with check (
    public.is_family_member(family_id)
    and updated_by = (select auth.uid())
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'family_recipe_cache'
  ) then
    alter publication supabase_realtime add table public.family_recipe_cache;
  end if;
exception when undefined_object then
  null;
end $$;
